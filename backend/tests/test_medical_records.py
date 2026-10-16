from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import create_app
from app.medical_records.models import MedicalRecord, MedicalRecordRevision


@pytest.fixture
def entities(client: TestClient):
    patient = client.post("/api/patients", json={
        "first_name": "Иван", "last_name": "Петров", "date_of_birth": "1990-01-02", "administrative_sex": "М",
    }).json()
    worker = client.post("/api/medical-workers", json={
        "first_name": "Грегори", "last_name": "Хаус", "position": "Врач-диагност",
    }).json()
    diagnosis = client.post("/api/diagnoses", json={"code": "4A40.0", "name": "Системная красная волчанка"}).json()
    return patient, worker, diagnosis


def record_url(entities):
    return f"/api/patients/{entities[0]['id']}/medical-record"


def saved_payload(entities, version=1):
    return {"worker_id": entities[1]["id"], "version": version,
            "diagnosis_ids": [entities[2]["id"]], "prescriptions": ["Контроль состояния"]}


def test_create_read_save_and_patient_protection(client: TestClient, database_engine: Engine, entities):
    patient, worker, diagnosis = entities
    url = record_url(entities)
    assert client.get(url).status_code == 404
    created = client.post(url, json={"worker_id": worker["id"]})
    assert created.status_code == 201
    record = created.json()
    assert record["patient_id"] == patient["id"]
    assert record["version"] == 1
    assert record["diagnoses"] == [] and record["prescriptions"] == []
    assert record["edited_by"] == {key: worker[key] for key in ("id", "first_name", "last_name", "position")}
    assert datetime.fromisoformat(record["updated_at"]).tzinfo is not None
    assert client.post(url, json={"worker_id": worker["id"]}).status_code == 409
    assert client.get(f"/api/patients/{patient['id']}").json()["has_medical_record"] is True
    assert client.delete(f"/api/patients/{patient['id']}").status_code == 409
    response = client.put(url, json={**saved_payload(entities), "prescriptions": ["  Контроль состояния  "]})
    assert response.status_code == 200
    updated = response.json()
    assert updated["version"] == 2
    assert updated["diagnoses"] == [{"diagnosis_id": diagnosis["id"], "code": diagnosis["code"], "name": diagnosis["name"]}]
    assert updated["prescriptions"] == ["Контроль состояния"]
    assert client.get(url).json() == updated
    with Session(database_engine) as session:
        assert len(list(session.scalars(select(MedicalRecord)))) == 1
        revisions = list(session.scalars(select(MedicalRecordRevision).order_by(MedicalRecordRevision.version)))
        assert [revision.action for revision in revisions] == ["created", "saved"]
        assert revisions[0].diagnoses == []
        assert revisions[1].diagnoses == updated["diagnoses"]


@pytest.mark.parametrize("worker_id", [None, 0, -1, True, "1", 99999])
def test_invalid_author_rejected_on_create_and_save(client: TestClient, entities, worker_id):
    url = record_url(entities)
    assert client.post(url, json={"worker_id": worker_id}).status_code == 422
    assert client.get(url).status_code == 404
    original = client.post(url, json={"worker_id": entities[1]["id"]}).json()
    assert client.put(url, json={**saved_payload(entities), "worker_id": worker_id}).status_code == 422
    assert client.get(url).json() == original


def test_author_is_required_and_deleted_worker_cannot_save(client: TestClient, entities):
    url = record_url(entities)
    assert client.post(url, json={}).status_code == 422
    original = client.post(url, json={"worker_id": entities[1]["id"]}).json()
    payload = saved_payload(entities)
    payload.pop("worker_id")
    assert client.put(url, json=payload).status_code == 422
    client.delete(f"/api/medical-workers/{entities[1]['id']}")
    assert client.put(url, json=saved_payload(entities)).status_code == 422
    assert client.get(url).json() == original


@pytest.mark.parametrize("text", ["", "аб", "а" * 129, "    ", None, 123])
def test_invalid_prescriptions_do_not_create_revision(client: TestClient, entities, text):
    url = record_url(entities)
    original = client.post(url, json={"worker_id": entities[1]["id"]}).json()
    assert client.put(url, json={**saved_payload(entities), "prescriptions": [text]}).status_code == 422
    assert client.get(url).json() == original


@pytest.mark.parametrize("length", [3, 128])
def test_prescription_boundaries(client: TestClient, entities, length):
    url = record_url(entities)
    client.post(url, json={"worker_id": entities[1]["id"]})
    assert client.put(url, json={**saved_payload(entities), "prescriptions": ["а" * length]}).status_code == 200


def test_duplicate_or_unknown_diagnoses_rejected(client: TestClient, entities):
    url = record_url(entities)
    original = client.post(url, json={"worker_id": entities[1]["id"]}).json()
    for diagnosis_ids in ([entities[2]["id"]] * 2, [99999], [True], [0]):
        assert client.put(url, json={**saved_payload(entities), "diagnosis_ids": diagnosis_ids}).status_code == 422
    assert client.get(url).json() == original


def test_stale_version_rejected_without_overwriting(client: TestClient, entities):
    url = record_url(entities)
    client.post(url, json={"worker_id": entities[1]["id"]})
    newest = client.put(url, json=saved_payload(entities)).json()
    assert client.put(url, json={**saved_payload(entities), "prescriptions": []}).status_code == 409
    assert client.get(url).json() == newest


def test_snapshot_survives_registry_changes_and_deletion(client: TestClient, entities):
    url = record_url(entities)
    client.post(url, json={"worker_id": entities[1]["id"]})
    saved = client.put(url, json=saved_payload(entities)).json()
    client.delete(f"/api/diagnoses/{entities[2]['id']}")
    response = client.put(url, json=saved_payload(entities, version=2))
    assert response.status_code == 200
    assert response.json()["diagnoses"] == saved["diagnoses"]


def test_author_snapshot_and_history_are_preserved(client: TestClient, database_engine: Engine, entities):
    url = record_url(entities)
    client.post(url, json={"worker_id": entities[1]["id"]})
    old = client.put(url, json=saved_payload(entities)).json()
    other = client.post("/api/medical-workers", json={"first_name": "Роберт", "last_name": "Чейз", "position": "Врач-диагност"}).json()
    updated = client.put(url, json={**saved_payload(entities, version=2), "worker_id": other["id"], "diagnosis_ids": [], "prescriptions": []}).json()
    assert updated["edited_by"]["id"] == other["id"]
    assert updated["diagnoses"] == [] and updated["prescriptions"] == []
    with Session(database_engine) as session:
        revisions = list(session.scalars(select(MedicalRecordRevision).order_by(MedicalRecordRevision.version)))
        assert len(revisions) == 3
        assert revisions[1].diagnoses == old["diagnoses"]
        assert revisions[1].prescriptions == old["prescriptions"]
        assert revisions[1].worker_id == entities[1]["id"]
        session.add(MedicalRecordRevision(
            medical_record_id=revisions[0].medical_record_id, version=3, worker_id=other["id"],
            editor=updated["edited_by"], action="saved", diagnoses=[], prescriptions=[],
        ))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("field", ["is_locked", "patient_id", "id", "edited_by"])
def test_service_fields_not_accepted(client: TestClient, entities, field):
    url = record_url(entities)
    assert client.post(url, json={"worker_id": entities[1]["id"], field: True}).status_code == 422
    client.post(url, json={"worker_id": entities[1]["id"]})
    assert client.put(url, json={**saved_payload(entities), field: True}).status_code == 422


def test_unknown_patient_and_restart(database_engine: Engine, client: TestClient, entities):
    unknown_url = "/api/patients/99999/medical-record"
    assert client.get(unknown_url).status_code == 404
    assert client.post(unknown_url, json={"worker_id": entities[1]["id"]}).status_code == 404
    assert client.put(unknown_url, json=saved_payload(entities)).status_code == 404
    url = record_url(entities)
    client.post(url, json={"worker_id": entities[1]["id"]})
    saved = client.put(url, json=saved_payload(entities)).json()
    database_engine.dispose()
    with TestClient(create_app(database_engine)) as restarted:
        assert restarted.get(url).json() == saved
        assert restarted.delete(f"/api/patients/{entities[0]['id']}").status_code == 409
