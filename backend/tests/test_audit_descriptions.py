import json

from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.audit.models import AuditEvent
from app.audit.stream import AuditListener
from app.medical_workers.models import MedicalWorker


def check_stream(database_engine, entries):
    listener = AuditListener(database_engine)
    try:
        snapshot = {row['event_id']: row for row in json.loads(listener.snapshot())}
        for entry in entries:
            assert snapshot[entry['event_id']]['display_message'] == entry['display_message']
            assert json.loads(listener.read_event(entry['event_id']))['display_message'] == entry['display_message']
    finally:
        listener.close()


def test_account_events_capture_login_and_worker_name_before_deletion(client, database_engine):
    worker = client.post('/api/medical-workers', json={
        'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач',
    }).json()
    account = client.post(f'/api/medical-workers/{worker["id"]}/account', json={'username': 'doctorLogin'}).json()['account']
    assert client.delete(f'/api/medical-workers/{worker["id"]}').status_code == 204
    assert client.delete(f'/api/accounts/{account["id"]}').status_code == 204
    entries = client.get('/api/audit').json()
    descriptions = [entry['display_message'] for entry in entries]
    assert 'Добавлен медработник «Иван Петров»' in descriptions
    assert 'Создан аккаунт «doctorLogin» для медработника «Иван Петров»' in descriptions
    assert 'Аккаунт «doctorLogin»: деактивирован при удалении медработника «Иван Петров»' in descriptions
    assert 'Удалён аккаунт «doctorLogin»; медработник и его история сохранены' in descriptions
    with Session(database_engine) as session:
        worker_row = session.get(MedicalWorker, worker['id'])
        worker_row.first_name = 'Пётр'
        session.commit()
    assert [entry['display_message'] for entry in client.get('/api/audit').json()] == descriptions
    check_stream(database_engine, entries)


def test_legacy_descriptions_resolve_login_and_soft_deleted_worker_without_rewriting(client, database_engine):
    with Session(database_engine) as session:
        worker = MedicalWorker(first_name='Иван', last_name='Петров', position='Врач', is_deleted=True)
        account = UserAccount(username='legacyLogin', password_hash='test-only-hash')
        session.add_all([worker, account])
        session.flush()
        originals = [f'Аккаунт {account.id}: активирован',
                     f'Аккаунт {account.id} деактивирован при удалении медработника {worker.id}']
        events = [AuditEvent(actor='system:test', message=message) for message in originals]
        session.add_all(events)
        session.commit()
        ids = [event.event_id for event in events]
    entries = client.get('/api/audit').json()
    assert {entry['display_message'] for entry in entries} == {
        'Аккаунт «legacyLogin»: активирован',
        'Аккаунт «legacyLogin» деактивирован при удалении медработника «Иван Петров»',
    }
    with Session(database_engine) as session:
        for event_id, original in zip(ids, originals):
            event = session.get(AuditEvent, event_id)
            assert event.message == original and event.display_message is None
    check_stream(database_engine, entries)


def test_record_descriptions_show_patient_initials_and_preserve_snapshots(client, database_engine):
    from datetime import date
    from app.patients.models import Patient
    from app.patients.types import AdministrativeSex
    from app.audit.service import append_audit_event

    with Session(database_engine) as session:
        patient = Patient(first_name='Алексей', last_name='Лебедев', patronymic='Андреевич',
                          date_of_birth=date(1981, 2, 18), administrative_sex=AdministrativeSex.MALE)
        session.add(patient)
        session.flush()
        original = f'Создана ЭМК 42 пациента {patient.id}; версия 1; автор медработник 99'
        entry = append_audit_event(session, actor='system:test', message=original)
        legacy = AuditEvent(actor='system:test', message=original, display_message=original)
        session.add(legacy)
        session.commit()
        entry_id, legacy_id, patient_id = entry.event_id, legacy.event_id, patient.id
        expected = 'Создана ЭМК для пациента «Лебедев А.А.»; версия 1; автор 99'
        assert entry.display_message == expected
    entries = client.get('/api/audit').json()
    assert all(row['display_message'] == expected for row in entries)
    check_stream(database_engine, entries)
    with Session(database_engine) as session:
        assert session.get(AuditEvent, legacy_id).display_message == original
        patient = session.get(Patient, patient_id)
        patient.last_name = 'Петров'
        session.commit()
    entries = client.get('/api/audit').json()
    assert next(row for row in entries if row['event_id'] == str(entry_id))['display_message'] == expected


def test_patient_initials_without_patronymic():
    from app.audit.presentation import patient_name
    assert patient_name('Дин', 'Винчестер', None) == 'Винчестер Д.'

