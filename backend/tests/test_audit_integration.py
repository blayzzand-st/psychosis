from tests.clinical import save_record, sign_in_worker
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.audit.models import AuditEvent
from app.audit.service import append_audit_event, record_login_event


WORKER = {'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач'}
PATIENT = {'first_name': 'Анна', 'last_name': 'Петрова', 'date_of_birth': '1990-01-02', 'administrative_sex': 'Ж'}


def messages(clinical_client):
    response = clinical_client.get('/api/audit')
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    return response.json()


def test_worker_patient_and_record_operations_are_audited(clinical_client):
    worker = clinical_client.post('/api/medical-workers', json=WORKER).json()
    url = f"/api/medical-workers/{worker['id']}"
    clinical_client.put(url, json={**WORKER, 'role': 'doctor'})
    entries = messages(clinical_client)
    assert [item['message'].split(':')[0] for item in entries][-1] == f"Изменён медработник {worker['id']}"
    # The role-change and worker-update events identify the same initiating request.
    assert entries[-1]['actor'] == entries[-2]['actor']
    assert entries[-1]['actor'].startswith('account:')
    patient = clinical_client.post('/api/patients', json=PATIENT).json()
    patient_url = f"/api/patients/{patient['id']}"
    clinical_client.put(patient_url, json={**PATIENT, 'comment': 'Пример'})
    chart = patient_url + '/medical-record'
    assert clinical_client.post(chart, json={}).status_code == 201
    assert save_record(clinical_client, chart, json={'version': 1, 'diagnosis_ids': [], 'prescriptions': []}).status_code == 200
    other = clinical_client.post('/api/patients', json=PATIENT).json()
    assert clinical_client.delete(f"/api/patients/{other['id']}").status_code == 204
    clinical_client.delete(url)
    clinical_client.post(url + '/restore')
    result = '\n'.join(item['message'] for item in messages(clinical_client))
    for expected in ['Добавлен медработник', 'Изменён медработник', 'Удалён медработник', 'Восстановлен медработник',
                     'Добавлен пациент', 'Изменён пациент', 'Удалён пациент', 'Создана ЭМК', 'Изменена ЭМК']:
        assert expected in result


def test_failed_operations_do_not_create_success_events(clinical_client):
    worker = clinical_client.post('/api/medical-workers', json=WORKER).json()
    patient = clinical_client.post('/api/patients', json=PATIENT).json()
    url = f"/api/patients/{patient['id']}/medical-record"
    clinical_client.post(url, json={})
    before = messages(clinical_client)
    assert clinical_client.post(url, json={}).status_code == 409
    assert save_record(clinical_client, url, json={'version': 0, 'diagnosis_ids': [], 'prescriptions': []}).status_code == 409
    assert clinical_client.delete(f"/api/patients/{patient['id']}").status_code == 409
    assert clinical_client.post('/api/medical-workers', json={**WORKER, 'first_name': ''}).status_code == 422
    assert messages(clinical_client) == before


def test_chronology_includes_late_committing_old_events(clinical_client, database_engine):
    now = datetime.now(timezone.utc)
    with Session(database_engine) as session:
        later = append_audit_event(session, actor='system:test', message='Позднее событие')
        later.event_time = now
        session.commit()
    with Session(database_engine) as session:
        earlier = append_audit_event(session, actor='system:test', message='Раннее событие')
        earlier.event_time = now - timedelta(seconds=1)
        session.commit()
    assert [item['message'] for item in messages(clinical_client) if item['actor'] == 'system:test'] == ['Раннее событие', 'Позднее событие']


@pytest.mark.parametrize('sql', ["UPDATE audit_events SET message = 'Подмена'", 'DELETE FROM audit_events', 'TRUNCATE audit_events'])
def test_database_prevents_mutation_even_through_direct_sql(clinical_client, database_engine, sql):
    clinical_client.post('/api/medical-workers', json=WORKER)
    before = messages(clinical_client)
    with database_engine.connect() as connection:
        with pytest.raises(DBAPIError, match='cannot be changed or deleted'):
            connection.execute(text(sql))
        connection.rollback()
    assert messages(clinical_client) == before


def test_api_has_no_audit_write_routes(clinical_client):
    clinical_client.post('/api/medical-workers', json=WORKER)
    before = messages(clinical_client)
    entry = before[0]
    for method in ['POST', 'PUT', 'PATCH', 'DELETE']:
        assert clinical_client.request(method, '/api/audit', json={'message': 'Подмена'}).status_code == 405
        assert clinical_client.request(method, '/api/audit/' + entry['event_id'], json={}).status_code in [404, 405]
    assert messages(clinical_client) == before


def test_authentication_audit_hook_distinguishes_actor_and_result(database_engine):
    account_id = uuid4()
    with Session(database_engine) as session:
        for administrator in [True, False]:
            record_login_event(session, administrator=administrator, success=True, account_id=account_id)
            record_login_event(session, administrator=administrator, success=False)
        session.commit()
        entries = list(session.scalars(select(AuditEvent)))
        assert len(entries) == 4
        assert sum(entry.actor == f'account:{account_id}' for entry in entries) == 2
        assert any('Успешный вход администратора' in entry.message for entry in entries)
        assert any('Успешный вход пользователя' in entry.message for entry in entries)
        assert sum('Неуспешная попытка' in entry.message for entry in entries) == 2
        with pytest.raises(ValueError):
            record_login_event(session, administrator=True, success=True)
