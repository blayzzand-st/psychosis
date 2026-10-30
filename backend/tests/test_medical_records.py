from tests.clinical import save_record, sign_in_worker
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import create_app
from app.medical_records.models import MedicalRecord, MedicalRecordRevision


@pytest.fixture
def entities(clinical_client: TestClient):
    patient = clinical_client.post("/api/patients", json={
        "first_name": "Иван", "last_name": "Петров", "date_of_birth": "1990-01-02", "administrative_sex": "М",
    }).json()
    worker = clinical_client.current_worker
    diagnosis = clinical_client.post("/api/diagnoses", json={"code": "4A40.0", "name": "Системная красная волчанка"}).json()
    return patient, worker, diagnosis


def record_url(entities):
    return f"/api/patients/{entities[0]['id']}/medical-record"


def saved_payload(entities, version=1):
    return {"version": version,
            "diagnosis_ids": [entities[2]["id"]], "prescriptions": ["Контроль состояния"]}


def test_create_read_save_and_patient_protection(clinical_client: TestClient, database_engine: Engine, entities):
    patient, worker, diagnosis = entities
    url = record_url(entities)
    assert clinical_client.get(url).status_code == 404
    created = clinical_client.post(url, json={})
    assert created.status_code == 201
    record = created.json()
    assert record["patient_id"] == patient["id"]
    assert record["version"] == 1
    assert record["diagnoses"] == [] and record["prescriptions"] == []
    assert record["edited_by"] == {key: worker[key] for key in ("id", "first_name", "last_name", "position")}
    assert datetime.fromisoformat(record["updated_at"]).tzinfo is not None
    assert clinical_client.post(url, json={}).status_code == 409
    assert clinical_client.get(f"/api/patients/{patient['id']}").json()["has_medical_record"] is True
    assert clinical_client.delete(f"/api/patients/{patient['id']}").status_code == 409
    response = save_record(clinical_client, url, json={**saved_payload(entities), "prescriptions": ["  Контроль состояния  "]})
    assert response.status_code == 200
    updated = response.json()
    assert updated["version"] == 2
    assert updated["diagnoses"] == [{"diagnosis_id": diagnosis["id"], "code": diagnosis["code"], "name": diagnosis["name"]}]
    assert updated["prescriptions"] == ["Контроль состояния"]
    assert clinical_client.get(url).json() == updated
    with Session(database_engine) as session:
        assert len(list(session.scalars(select(MedicalRecord)))) == 1
        revisions = list(session.scalars(select(MedicalRecordRevision).order_by(MedicalRecordRevision.version)))
        assert [revision.action for revision in revisions] == ["created", "saved"]
        assert revisions[0].diagnoses == []
        assert revisions[1].diagnoses == updated["diagnoses"]


@pytest.mark.parametrize("worker_id", [None, 0, -1, True, "1", 99999])
def test_invalid_author_rejected_on_create_and_save(clinical_client: TestClient, entities, worker_id):
    url = record_url(entities)
    assert clinical_client.post(url, json={"worker_id": worker_id}).status_code == 422
    assert clinical_client.get(url).status_code == 404
    original = clinical_client.post(url, json={}).json()
    assert save_record(clinical_client, url, json={**saved_payload(entities), "worker_id": worker_id}).status_code == 422
    assert clinical_client.get(url).json() == original


def test_author_comes_from_session_and_deleted_worker_cannot_save(clinical_client: TestClient, entities):
    url = record_url(entities)
    original = clinical_client.post(url, json={}).json()
    assert original['edited_by']['id'] == clinical_client.current_worker['id']
    assert clinical_client.put(url, json=saved_payload(entities)).status_code == 422
    grant = clinical_client.post(url + '/unlock').json()['edit_token']
    clinical_client.delete(f"/api/medical-workers/{entities[1]['id']}")
    assert clinical_client.put(url, json={**saved_payload(entities), 'edit_token': grant}).status_code == 401
    assert clinical_client.get(url).status_code == 401


@pytest.mark.parametrize("text", ["", "аб", "а" * 129, "    ", None, 123])
def test_invalid_prescriptions_do_not_create_revision(clinical_client: TestClient, entities, text):
    url = record_url(entities)
    original = clinical_client.post(url, json={}).json()
    assert save_record(clinical_client, url, json={**saved_payload(entities), "prescriptions": [text]}).status_code == 422
    assert clinical_client.get(url).json() == original


@pytest.mark.parametrize("length", [3, 128])
def test_prescription_boundaries(clinical_client: TestClient, entities, length):
    url = record_url(entities)
    clinical_client.post(url, json={})
    assert save_record(clinical_client, url, json={**saved_payload(entities), "prescriptions": ["а" * length]}).status_code == 200


def test_duplicate_or_unknown_diagnoses_rejected(clinical_client: TestClient, entities):
    url = record_url(entities)
    original = clinical_client.post(url, json={}).json()
    for diagnosis_ids in ([entities[2]["id"]] * 2, [99999], [True], [0]):
        assert save_record(clinical_client, url, json={**saved_payload(entities), "diagnosis_ids": diagnosis_ids}).status_code == 422
    assert clinical_client.get(url).json() == original


def test_stale_version_rejected_without_overwriting(clinical_client: TestClient, entities):
    url = record_url(entities)
    clinical_client.post(url, json={})
    newest = save_record(clinical_client, url, json=saved_payload(entities)).json()
    assert save_record(clinical_client, url, json={**saved_payload(entities), "prescriptions": []}).status_code == 409
    assert clinical_client.get(url).json() == newest


def test_snapshot_survives_registry_changes_and_deletion(clinical_client: TestClient, entities):
    url = record_url(entities)
    clinical_client.post(url, json={})
    saved = save_record(clinical_client, url, json=saved_payload(entities)).json()
    clinical_client.delete(f"/api/diagnoses/{entities[2]['id']}")
    response = save_record(clinical_client, url, json=saved_payload(entities, version=2))
    assert response.status_code == 200
    assert response.json()["diagnoses"] == saved["diagnoses"]


def test_author_snapshot_and_history_are_preserved(clinical_client: TestClient, database_engine: Engine, entities):
    url = record_url(entities)
    clinical_client.post(url, json={})
    old = save_record(clinical_client, url, json=saved_payload(entities)).json()
    other = clinical_client.post("/api/medical-workers", json={"first_name": "Роберт", "last_name": "Чейз", "position": "Врач-диагност"}).json()
    other = sign_in_worker(clinical_client, other)
    updated = save_record(clinical_client, url, json={**saved_payload(entities, version=2), "diagnosis_ids": [], "prescriptions": []}).json()
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
def test_service_fields_not_accepted(clinical_client: TestClient, entities, field):
    url = record_url(entities)
    assert clinical_client.post(url, json={field: True}).status_code == 422
    clinical_client.post(url, json={})
    assert save_record(clinical_client, url, json={**saved_payload(entities), field: True}).status_code == 422


def test_unknown_patient_and_restart(database_engine: Engine, clinical_client: TestClient, entities):
    unknown_url = "/api/patients/99999/medical-record"
    assert clinical_client.get(unknown_url).status_code == 404
    assert clinical_client.post(unknown_url, json={}).status_code == 404
    assert save_record(clinical_client, unknown_url, json=saved_payload(entities)).status_code == 404
    url = record_url(entities)
    clinical_client.post(url, json={})
    saved = save_record(clinical_client, url, json=saved_payload(entities)).json()
    database_engine.dispose()
    with TestClient(create_app(database_engine), cookies=clinical_client.cookies) as restarted:
        assert restarted.get(url).json() == saved
        assert restarted.delete(f"/api/patients/{entities[0]['id']}").status_code == 409
