import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.diagnoses.models import Diagnosis
from app.diagnoses.seed import EXAMPLES, seed_diagnoses
from app.main import create_app


API = "/api/diagnoses"
VALID = {"code": "4A40.0", "name": "Системная красная волчанка"}


def test_crud_physically_deletes_record(client: TestClient, database_engine: Engine):
    response = client.post(API, json=VALID)
    assert response.status_code == 201
    record = response.json()
    url = f"{API}/{record['id']}"
    assert record == {**VALID, "id": record["id"]}
    assert client.get(API).json() == [record]
    assert client.get(url).json() == record
    changed = {"code": "CA23.0", "name": "Аллергическая астма"}
    assert client.put(url, json=changed).json() == {**changed, "id": record["id"]}
    deleted = client.delete(url)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(API).json() == []
    for method in ("GET", "PUT", "DELETE"):
        assert client.request(method, url, json=VALID if method == "PUT" else None).status_code == 404
    with Session(database_engine) as session:
        assert session.get(Diagnosis, record["id"]) is None
    assert client.post(API, json=changed).status_code == 201


@pytest.mark.parametrize("field,value", [
    ("code", "12345"), ("code", "1234567"), ("code", "      "),
    ("code", None), ("code", 123456), ("code", "ß" * 6),
    ("name", "аб"), ("name", "а" * 129), ("name", "   "), ("name", None),
])
def test_validation_does_not_change_record(client: TestClient, field: str, value):
    record = client.post(API, json=VALID).json()
    invalid = {**VALID, field: value}
    assert client.post(API, json=invalid).status_code == 422
    assert client.put(f"{API}/{record['id']}", json=invalid).status_code == 422
    assert client.get(API).json() == [record]


@pytest.mark.parametrize("field", ["code", "name"])
def test_unique_fields_reject_create_and_update(client: TestClient, field: str):
    first = client.post(API, json=VALID).json()
    other = {"code": "CA23.0", "name": "Аллергическая астма"}
    second = client.post(API, json=other).json()
    duplicate = {**other, field: VALID[field]}
    assert client.post(API, json=duplicate).status_code == 409
    assert client.put(f"{API}/{second['id']}", json=duplicate).status_code == 409
    assert client.get(API).json() == [first, second]
    assert client.put(f"{API}/{first['id']}", json=VALID).status_code == 200


@pytest.mark.parametrize("length", [3, 128])
def test_name_boundaries_and_normalization(client: TestClient, length: int):
    response = client.post(API, json={"code": " ca23.0 ", "name": f"  {'а' * length}  "})
    assert response.status_code == 201
    assert response.json()["code"] == "CA23.0"
    assert response.json()["name"] == "а" * length


@pytest.mark.parametrize("field", ["code", "name"])
def test_required_fields(client: TestClient, field: str):
    assert client.post(API, json={key: value for key, value in VALID.items() if key != field}).status_code == 422


@pytest.mark.parametrize("field", ["id", "is_deleted", "unknown"])
def test_service_and_unknown_fields_rejected(client: TestClient, field: str):
    assert client.post(API, json={**VALID, field: True}).status_code == 422


@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
def test_unknown_id(client: TestClient, method: str):
    assert client.request(method, f"{API}/99999", json=VALID if method == "PUT" else None).status_code == 404


@pytest.mark.parametrize("payload", [{**VALID, "code": "123"}, {**VALID, "name": "аб"}])
def test_database_length_constraints(database_engine: Engine, payload):
    with Session(database_engine) as session:
        session.add(Diagnosis(**payload))
        with pytest.raises(IntegrityError):
            session.commit()


def test_seed_is_explicit_idempotent_and_survives_restart(database_engine: Engine, admin_cookie):
    with Session(database_engine) as session:
        assert seed_diagnoses(session) == 5
        assert seed_diagnoses(session) == 0
    with TestClient(create_app(database_engine), cookies=admin_cookie) as client:
        records = client.get(API).json()
        assert [(record["code"], record["name"]) for record in records] == list(EXAMPLES)
        deleted_id = records[0]["id"]
        client.delete(f"{API}/{deleted_id}")
    database_engine.dispose()
    with TestClient(create_app(database_engine), cookies=admin_cookie) as client:
        assert len(client.get(API).json()) == 4
        assert client.get(f"{API}/{deleted_id}").status_code == 404
