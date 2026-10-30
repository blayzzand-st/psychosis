from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import create_app
from app.patients.models import Patient
from app.medical_records.models import MedicalRecord


API = "/api/patients"
VALID = {
    "first_name": "Иван", "last_name": "Петров", "patronymic": "Иванович",
    "date_of_birth": "1990-05-12", "administrative_sex": "М", "comment": "Аллергия на пенициллин",
}


def test_crud_and_physical_deletion(clinical_client: TestClient, database_engine: Engine):
    response = clinical_client.post(API, json=VALID)
    assert response.status_code == 201
    patient = response.json()
    url = f"{API}/{patient['id']}"
    assert patient == {**VALID, "id": patient["id"], "has_medical_record": False}
    assert clinical_client.get(API).json() == [patient]
    assert clinical_client.get(url).json() == patient
    changed = {**VALID, "first_name": "Анна", "last_name": "Иванова", "patronymic": None, "administrative_sex": "Ж", "comment": ""}
    updated = clinical_client.put(url, json=changed)
    assert updated.status_code == 200
    assert updated.json() == {**changed, "id": patient["id"], "has_medical_record": False}
    response = clinical_client.delete(url)
    assert response.status_code == 204
    assert response.content == b""
    assert clinical_client.get(API).json() == []
    assert clinical_client.get(url).status_code == 404
    with Session(database_engine) as session:
        assert session.get(Patient, patient["id"]) is None


def test_record_blocks_deletion_in_api_and_database(clinical_client: TestClient, database_engine: Engine):
    patient = clinical_client.post(API, json=VALID).json()
    with Session(database_engine) as session:
        session.add(MedicalRecord(patient_id=patient["id"]))
        session.commit()
    url = f"{API}/{patient['id']}"
    assert clinical_client.get(url).json()["has_medical_record"] is True
    assert clinical_client.get(API).json()[0]["has_medical_record"] is True
    assert clinical_client.delete(url).status_code == 409
    assert clinical_client.get(url).json()["first_name"] == VALID["first_name"]
    assert clinical_client.put(url, json={**VALID, "comment": "Проверка изменения"}).status_code == 200
    with Session(database_engine) as session:
        with pytest.raises(IntegrityError):
            session.execute(delete(Patient).where(Patient.id == patient["id"]))
            session.commit()
        session.rollback()
        assert session.get(Patient, patient["id"]) is not None


def test_only_one_record_per_patient(database_engine: Engine, clinical_client: TestClient):
    patient = clinical_client.post(API, json=VALID).json()
    with Session(database_engine) as session:
        session.add(MedicalRecord(patient_id=patient["id"]))
        session.commit()
        session.add(MedicalRecord(patient_id=patient["id"]))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("field,value", [
    ("first_name", ""), ("first_name", " " * 3), ("last_name", "а" * 65),
    ("first_name", None), ("last_name", 123), ("patronymic", "а" * 65),
    ("comment", "а" * 33), ("comment", None), ("administrative_sex", "X"),
    ("date_of_birth", "2000-02-30"), ("date_of_birth", "01.01.2000"),
    ("date_of_birth", 0), ("date_of_birth", (date.today() + timedelta(days=1)).isoformat()),
])
def test_invalid_input_does_not_modify_record(clinical_client: TestClient, field: str, value):
    patient = clinical_client.post(API, json=VALID).json()
    payload = {**VALID, field: value}
    assert clinical_client.post(API, json=payload).status_code == 422
    assert clinical_client.put(f"{API}/{patient['id']}", json=payload).status_code == 422
    assert clinical_client.get(API).json() == [patient]


@pytest.mark.parametrize("length", [1, 64])
def test_name_and_comment_boundaries(clinical_client: TestClient, length: int):
    payload = {**VALID, "first_name": "а" * length, "last_name": "б" * length, "patronymic": "в" * length, "comment": "г" * 32}
    assert clinical_client.post(API, json=payload).status_code == 201


def test_optional_fields_and_normalization(clinical_client: TestClient):
    payload = {"first_name": " Ян ", "last_name": " Ли ", "date_of_birth": date.today().isoformat(), "administrative_sex": "НУ"}
    response = clinical_client.post(API, json=payload)
    assert response.status_code == 201
    patient = response.json()
    assert patient["first_name"] == "Ян"
    assert patient["last_name"] == "Ли"
    assert patient["patronymic"] is None
    assert patient["comment"] == ""
    assert clinical_client.put(f"{API}/{patient['id']}", json={**payload, "patronymic": "  "}).json()["patronymic"] is None


@pytest.mark.parametrize("field", ["first_name", "last_name", "date_of_birth", "administrative_sex"])
def test_required_fields(clinical_client: TestClient, field: str):
    assert clinical_client.post(API, json={key: value for key, value in VALID.items() if key != field}).status_code == 422


@pytest.mark.parametrize("field", ["id", "has_medical_record", "is_deleted", "unknown"])
def test_service_fields_rejected(clinical_client: TestClient, field: str):
    patient = clinical_client.post(API, json=VALID).json()
    assert clinical_client.post(API, json={**VALID, field: True}).status_code == 422
    assert clinical_client.put(f"{API}/{patient['id']}", json={**VALID, field: True}).status_code == 422


@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE"])
def test_not_found(clinical_client: TestClient, method: str):
    assert clinical_client.request(method, f"{API}/99999", json=VALID if method == "PUT" else None).status_code == 404


def test_patient_and_record_survive_restart(database_engine: Engine, clinical_client):
    with TestClient(create_app(database_engine), cookies=clinical_client.cookies) as restarted:
        patient = restarted.post(API, json=VALID).json()
    with Session(database_engine) as session:
        session.add(MedicalRecord(patient_id=patient["id"]))
        session.commit()
    database_engine.dispose()
    with TestClient(create_app(database_engine), cookies=clinical_client.cookies) as restarted:
        url = f"{API}/{patient['id']}"
        assert restarted.get(url).json() == {**patient, "has_medical_record": True}
        assert clinical_client.delete(url).status_code == 409
