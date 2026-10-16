from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.main import create_app
from app.medical_records.models import MedicalRecord, MedicalRecordChange, MedicalRecordPrescriptionLinks, MedicalRecordRevision


@pytest.fixture
def chart(client: TestClient):
    patient = client.post('/api/patients', json={
        'first_name': 'Анна', 'last_name': 'Петрова', 'date_of_birth': '1990-01-02', 'administrative_sex': 'Ж',
    }).json()
    worker = client.post('/api/medical-workers', json={
        'first_name': 'Роберт', 'last_name': 'Чейз', 'position': 'Врач-диагност',
    }).json()
    diagnosis = client.post('/api/diagnoses', json={'code': '4A40.0', 'name': 'Системная красная волчанка'}).json()
    url = f"/api/patients/{patient['id']}/medical-record"
    assert client.post(url, json={'worker_id': worker['id']}).status_code == 201
    return url, worker, diagnosis


def save(client, chart, version, diagnoses, prescriptions):
    url, worker, _ = chart
    return client.put(url, json={
        'worker_id': worker['id'], 'version': version, 'diagnosis_ids': diagnoses, 'prescriptions': prescriptions,
    })


def test_every_operation_and_prescription_edit_are_recorded(client: TestClient, chart):
    url, worker, diagnosis = chart
    assert save(client, chart, 1, [diagnosis['id']], ['Первое назначение', 'Второе назначение']).status_code == 200
    assert save(client, chart, 2, [], ['Изменённое назначение', 'Второе назначение']).status_code == 200
    assert save(client, chart, 3, [], []).status_code == 200
    history = client.get(url + '/history').json()
    assert [entry['version'] for entry in history] == [1, 2, 3, 4]
    assert history[0]['changes'] == [{'kind': 'record_created', 'data': {}}]
    assert history[1]['changes'] == [
        {'kind': 'diagnosis_added', 'data': {'diagnosis_id': diagnosis['id'], 'code': diagnosis['code'], 'name': diagnosis['name']}},
        {'kind': 'prescription_added', 'data': {'text': 'Первое назначение'}},
        {'kind': 'prescription_added', 'data': {'text': 'Второе назначение'}},
    ]
    assert [change['kind'] for change in history[2]['changes']] == ['diagnosis_removed', 'prescription_cancelled', 'prescription_added']
    assert history[2]['changes'][1]['data'] == {'text': 'Первое назначение'}
    assert history[2]['changes'][2]['data'] == {'text': 'Изменённое назначение'}
    assert history[2]['prescriptions'] == ['Изменённое назначение', 'Второе назначение']
    assert history[3]['changes'] == [
        {'kind': 'prescription_cancelled', 'data': {'text': 'Изменённое назначение'}},
        {'kind': 'prescription_cancelled', 'data': {'text': 'Второе назначение'}},
    ]
    assert all(entry['edited_by']['id'] == worker['id'] and datetime.fromisoformat(entry['updated_at']).tzinfo for entry in history)


def test_duplicate_prescriptions_keep_multiplicity_and_unchanged_save(client: TestClient, chart):
    url, _, _ = chart
    save(client, chart, 1, [], ['Контроль состояния', 'Контроль состояния'])
    save(client, chart, 2, [], ['Контроль состояния'])
    save(client, chart, 3, [], ['Контроль состояния'])
    history = client.get(url + '/history').json()
    assert len(history[1]['changes']) == 2
    assert history[2]['changes'] == [{'kind': 'prescription_cancelled', 'data': {'text': 'Контроль состояния'}}]
    assert history[3]['changes'] == [{'kind': 'record_saved', 'data': {}}]


def test_edit_to_existing_text_and_cancel_other_row_preserves_both_operations(client: TestClient, chart):
    url, worker, _ = chart
    save(client, chart, 1, [], ['Первичный осмотр', 'Повторный осмотр'])
    response = client.put(url, json={
        'worker_id': worker['id'], 'version': 2, 'diagnosis_ids': [],
        'prescriptions': ['Повторный осмотр'], 'prescription_sources': [0],
    })
    assert response.status_code == 200
    assert client.get(url + '/history').json()[-1]['changes'] == [
        {'kind': 'prescription_cancelled', 'data': {'text': 'Первичный осмотр'}},
        {'kind': 'prescription_cancelled', 'data': {'text': 'Повторный осмотр'}},
        {'kind': 'prescription_added', 'data': {'text': 'Повторный осмотр'}},
    ]
    response = client.put(url, json={
        'worker_id': worker['id'], 'version': 3, 'diagnosis_ids': [],
        'prescriptions': ['Повторный осмотр'], 'prescription_sources': [None],
    })
    assert response.status_code == 200  # Cancel and add identical text is still two explicit actions.
    assert [item['kind'] for item in client.get(url + '/history').json()[-1]['changes']] == ['prescription_cancelled', 'prescription_added']


@pytest.mark.parametrize('sources', [[], [0, 0], [2], [-1], [True], ['0']])
def test_invalid_prescription_sources_do_not_change_history(client: TestClient, chart, sources):
    url, worker, _ = chart
    save(client, chart, 1, [], ['Первичный осмотр'])
    history = client.get(url + '/history').json()
    assert client.put(url, json={
        'worker_id': worker['id'], 'version': 2, 'diagnosis_ids': [],
        'prescriptions': ['Повторный осмотр'] * max(1, len(sources)), 'prescription_sources': sources,
    }).status_code == 422
    assert client.get(url + '/history').json() == history


def test_state_at_any_moment_including_boundaries_and_timezone(client: TestClient, database_engine: Engine, chart):
    url, _, diagnosis = chart
    save(client, chart, 1, [diagnosis['id']], ['Контроль состояния'])
    save(client, chart, 2, [], [])
    start = datetime(2026, 1, 1, 10, 0, 0, 123456, tzinfo=timezone.utc)
    with Session(database_engine) as session:
        revisions = list(session.scalars(select(MedicalRecordRevision).order_by(MedicalRecordRevision.version)))
        for index, revision in enumerate(revisions):
            revision.recorded_at = start + timedelta(hours=index)
        session.commit()
    assert client.get(url, params={'at': (start - timedelta(microseconds=1)).isoformat()}).status_code == 404
    for offset, version in [(timedelta(0), 1), (timedelta(minutes=30), 1), (timedelta(hours=1), 2),
                            (timedelta(hours=2) - timedelta(microseconds=1), 2), (timedelta(hours=2), 3), (timedelta(days=1), 3)]:
        response = client.get(url, params={'at': (start + offset).isoformat()})
        assert response.status_code == 200
        record = response.json()
        assert record['version'] == version
        assert bool(record['diagnoses']) == (version == 2)
        assert bool(record['prescriptions']) == (version == 2)
    moscow_time = (start + timedelta(hours=1)).astimezone(timezone(timedelta(hours=3)))
    assert client.get(url, params={'at': moscow_time.isoformat()}).json()['version'] == 2
    assert client.get(url).json()['version'] == 3  # Viewing history never changes the current state.


@pytest.mark.parametrize('at', ['2026-01-01T10:00:00', 'not-a-date', '2026-02-30T10:00:00Z'])
def test_invalid_or_ambiguous_time_rejected(client: TestClient, chart, at):
    assert client.get(chart[0], params={'at': at}).status_code == 422


def test_history_survives_registry_delete_worker_changes_and_restart(client: TestClient, database_engine: Engine, chart):
    url, worker, diagnosis = chart
    save(client, chart, 1, [diagnosis['id']], ['Контроль состояния'])
    before = client.get(url + '/history').json()
    assert client.delete(f"/api/diagnoses/{diagnosis['id']}").status_code == 204
    assert client.put(f"/api/medical-workers/{worker['id']}", json={
        'first_name': 'Грегори', 'last_name': 'Хаус', 'position': 'Врач-диагност',
    }).status_code == 200
    assert client.delete(f"/api/medical-workers/{worker['id']}").status_code == 204
    with TestClient(create_app(database_engine)) as restarted:
        assert restarted.get(url + '/history').json() == before
        restored = restarted.get(url, params={'at': before[1]['updated_at']}).json()
        assert restored['diagnoses'] == before[1]['diagnoses']
        assert restored['edited_by']['first_name'] == 'Роберт'


def test_rejected_write_does_not_add_history(client: TestClient, database_engine: Engine, chart):
    url, worker, diagnosis = chart
    save(client, chart, 1, [diagnosis['id']], ['Контроль состояния'])
    before = client.get(url + '/history').json()
    assert save(client, chart, 1, [], []).status_code == 409
    assert save(client, chart, 2, [], ['аб']).status_code == 422
    assert client.put(url, json={'version': 2, 'diagnosis_ids': [], 'prescriptions': []}).status_code == 422
    assert client.get(url + '/history').json() == before
    with Session(database_engine) as session:
        assert session.scalar(select(func.count()).select_from(MedicalRecordRevision)) == 2
        assert session.scalar(select(func.count()).select_from(MedicalRecordChange)) == 3


def test_existing_snapshots_backfilled_idempotently(client: TestClient, database_engine: Engine, chart):
    url, worker, diagnosis = chart
    # Emulate versions saved before the detailed action journal was introduced.
    with Session(database_engine) as session:
        record = session.scalar(select(MedicalRecord))
        session.add(MedicalRecordRevision(
            medical_record_id=record.id, version=2, worker_id=worker['id'],
            editor={key: worker[key] for key in ('id', 'first_name', 'last_name', 'position')},
            action='saved', diagnoses=[{'diagnosis_id': diagnosis['id'], 'code': diagnosis['code'], 'name': diagnosis['name']}],
            prescriptions=['Контроль состояния'],
        ))
        session.commit()
    with TestClient(create_app(database_engine)) as restarted:
        first = restarted.get(url + '/history').json()
        assert [change['kind'] for change in first[1]['changes']] == ['diagnosis_added', 'prescription_added']
    with TestClient(create_app(database_engine)) as restarted:
        assert restarted.get(url + '/history').json() == first


def test_history_is_read_only_and_requires_existing_record(client: TestClient, chart):
    history_url = chart[0] + '/history'
    for method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        assert client.request(method, history_url, json={}).status_code == 405
    assert client.get('/api/patients/99999/medical-record/history').status_code == 404
    patient = client.post('/api/patients', json={
        'first_name': 'Иван', 'last_name': 'Петров', 'date_of_birth': '1990-01-02', 'administrative_sex': 'М',
    }).json()
    assert client.get(f"/api/patients/{patient['id']}/medical-record/history").status_code == 404


def test_prescription_links_preserve_identity_and_survive_restart(client: TestClient, database_engine: Engine, chart):
    url, worker, _ = chart
    save(client, chart, 1, [], ['Контроль состояния'])
    for version, texts, sources in [(2, ['Контроль состояния', 'Контроль состояния'], [0, None]),
                                     (3, ['Контроль состояния'], [1])]:
        assert client.put(url, json={
            'worker_id': worker['id'], 'version': version, 'diagnosis_ids': [],
            'prescriptions': texts, 'prescription_sources': sources,
        }).status_code == 200
    history = client.get(url + '/history').json()
    assert [entry['prescription_sources'] for entry in history] == [None, None, [0, None], [1]]
    assert client.put(url, json={
        'worker_id': worker['id'], 'version': 3, 'diagnosis_ids': [], 'prescriptions': [], 'prescription_sources': [],
    }).status_code == 409
    with Session(database_engine) as session:
        assert session.scalar(select(func.count()).select_from(MedicalRecordPrescriptionLinks)) == 2
    with TestClient(create_app(database_engine)) as restarted:
        assert restarted.get(url + '/history').json() == history
