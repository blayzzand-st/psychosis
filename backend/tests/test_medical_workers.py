import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import create_app
from app.medical_workers.models import MedicalWorker


API = "/api/medical-workers"
VALID_WORKER = {
    "first_name": "Иван",
    "last_name": "Петров",
    "position": "Терапевт",
}
FIELDS = ("first_name", "last_name", "position")


def test_crud_and_soft_delete(client: TestClient, database_engine: Engine):
    created = client.post(API, json=VALID_WORKER)
    assert created.status_code == 201
    worker = created.json()
    assert worker == {**VALID_WORKER, "id": worker["id"], "is_deleted": False}
    worker_url = f"{API}/{worker['id']}"

    assert client.get(API).json() == [worker]
    assert client.get(worker_url).json() == worker

    updated_fields = {"first_name": "Анна", "last_name": "Иванова", "position": "Хирург"}
    updated = client.put(worker_url, json=updated_fields)
    assert updated.status_code == 200
    updated_worker = {**updated_fields, "id": worker["id"], "is_deleted": False}
    assert updated.json() == updated_worker

    deleted = client.delete(worker_url)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get(API).json() == []
    assert client.get(worker_url).status_code == 404
    assert client.get(worker_url, params={"include_deleted": True}).json() == {
        **updated_worker, "is_deleted": True
    }
    assert client.put(worker_url, json=VALID_WORKER).status_code == 404
    assert client.delete(worker_url).status_code == 404
    assert client.put(worker_url, params={"include_deleted": True}, json=VALID_WORKER).status_code == 404
    assert client.delete(worker_url, params={"include_deleted": True}).status_code == 404
    assert client.get(API, params={"include_deleted": True}).json() == [
        {**updated_worker, "is_deleted": True}
    ]

    with Session(database_engine) as session:
        stored_worker = session.get(MedicalWorker, worker["id"])
        assert stored_worker is not None
        assert stored_worker.is_deleted is True
        assert stored_worker.first_name == updated_fields["first_name"]


def test_restore_preserves_card_and_reenables_editing(client: TestClient, database_engine: Engine):
    worker = client.post(API, json=VALID_WORKER).json()
    worker_url = f"{API}/{worker['id']}"
    client.delete(worker_url)

    restored = client.post(f"{worker_url}/restore")
    assert restored.status_code == 200
    assert restored.json() == worker
    assert client.get(API).json() == [worker]
    assert client.get(worker_url).json() == worker
    assert client.post(f"{worker_url}/restore").json() == worker
    assert client.get(API).json() == [worker]

    with Session(database_engine) as session:
        assert session.get(MedicalWorker, worker["id"]).is_deleted is False

    updated = client.put(worker_url, json={**VALID_WORKER, "position": "Хирург"})
    assert updated.status_code == 200
    assert updated.json()["position"] == "Хирург"


def test_restore_unknown_worker_returns_404(client: TestClient):
    assert client.post(f"{API}/99999/restore").status_code == 404
    assert client.get(API).json() == []


@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("value", ["", "аб", "а" * 25, "   ", None, 123])
def test_invalid_fields_are_rejected(client: TestClient, field: str, value):
    invalid_worker = {**VALID_WORKER, field: value}
    assert client.post(API, json=invalid_worker).status_code == 422

    worker = client.post(API, json=VALID_WORKER).json()
    worker_url = f"{API}/{worker['id']}"
    assert client.put(worker_url, json=invalid_worker).status_code == 422
    assert client.get(worker_url).json() == worker


@pytest.mark.parametrize("length", [3, 24])
def test_length_boundaries_are_accepted(client: TestClient, length: int):
    payload = {field: "а" * length for field in FIELDS}
    response = client.post(API, json=payload)
    assert response.status_code == 201
    assert all(response.json()[field] == payload[field] for field in FIELDS)


def test_whitespace_is_trimmed(client: TestClient):
    payload = {field: f"  {value}  " for field, value in VALID_WORKER.items()}
    response = client.post(API, json=payload)
    assert response.status_code == 201
    assert all(response.json()[field] == value for field, value in VALID_WORKER.items())


@pytest.mark.parametrize("field", FIELDS)
def test_all_fields_are_required(client: TestClient, field: str):
    payload = {key: value for key, value in VALID_WORKER.items() if key != field}
    assert client.post(API, json=payload).status_code == 422


@pytest.mark.parametrize("field", ["id", "is_deleted", "unknown"])
def test_clients_cannot_set_service_or_unknown_fields(client: TestClient, field: str):
    payload = {**VALID_WORKER, field: True}
    assert client.post(API, json=payload).status_code == 422
    worker = client.post(API, json=VALID_WORKER).json()
    worker_url = f"{API}/{worker['id']}"
    assert client.put(worker_url, json=payload).status_code == 422
    assert client.get(worker_url).json() == worker


@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
def test_unknown_worker_returns_404(client: TestClient, method: str):
    response = client.request(
        method,
        f"{API}/99999",
        json=VALID_WORKER if method == "PUT" else None,
    )
    assert response.status_code == 404


@pytest.mark.parametrize("field", FIELDS)
def test_database_also_enforces_field_lengths(database_engine: Engine, field: str):
    with Session(database_engine) as session:
        session.add(MedicalWorker(**{**VALID_WORKER, field: "аб"}))
        with pytest.raises(IntegrityError):
            session.commit()


def test_records_survive_application_restart(database_engine: Engine):
    with TestClient(create_app(database_engine)) as first_client:
        worker = first_client.post(API, json=VALID_WORKER).json()

    database_engine.dispose()
    with TestClient(create_app(database_engine)) as second_client:
        assert second_client.get(f"{API}/{worker['id']}").json() == worker
