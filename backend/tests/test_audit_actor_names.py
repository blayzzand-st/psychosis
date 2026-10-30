import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.admin_auth.models import Administrator
from app.audit.models import AuditEvent
from app.audit.service import record_login_event
from app.audit.stream import AuditListener


def assert_actor_label(client, database_engine, event_id, expected):
    entries = client.get('/api/audit').json()
    assert next(entry for entry in entries if entry['event_id'] == str(event_id))['actor_label'] == expected
    listener = AuditListener(database_engine)
    try:
        entries = json.loads(listener.snapshot())
        assert next(entry for entry in entries if entry['event_id'] == str(event_id))['actor_label'] == expected
        assert json.loads(listener.read_event(event_id))['actor_label'] == expected
    finally:
        listener.close()


def test_administrator_label_is_saved_and_returned_by_rest_and_sse(client, database_engine):
    response = client.post('/api/medical-workers', json={'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач'})
    assert response.status_code == 201
    with Session(database_engine) as session:
        event = session.scalar(select(AuditEvent))
        assert event.actor_label == 'Администратор'
        event_id = event.event_id
    assert_actor_label(client, database_engine, event_id, 'Администратор')


def test_legacy_actor_ids_resolve_without_modifying_audit_records(client, database_engine):
    with Session(database_engine) as session:
        admin = session.get(Administrator, 1)
        account = UserAccount(username='legacyUser', password_hash='test-only-hash')
        session.add(account)
        session.flush()
        events = [AuditEvent(actor=f'account:{admin.account_id}', message='Старый вход администратора'),
                  AuditEvent(actor=f'account:{account.id}', message='Старый вход пользователя')]
        session.add_all(events)
        session.commit()
        ids = [event.event_id for event in events]
    for event_id, name in zip(ids, ['Администратор', 'legacyUser']):
        assert_actor_label(client, database_engine, event_id, name)
    with Session(database_engine) as session:
        assert all(session.get(AuditEvent, event_id).actor_label is None for event_id in ids)


def test_username_snapshot_survives_account_rename_and_deletion(client, database_engine):
    with Session(database_engine) as session:
        account = UserAccount(username='originalLogin', password_hash='test-only-hash')
        session.add(account)
        session.commit()
        record_login_event(session, administrator=False, success=True, account_id=account.id)
        session.commit()
        event_id = session.scalar(select(AuditEvent.event_id))
        account.username = 'renamedLogin'
        session.commit()
    assert_actor_label(client, database_engine, event_id, 'originalLogin')
    with Session(database_engine) as session:
        session.delete(session.scalar(select(UserAccount)))
        session.commit()
    assert_actor_label(client, database_engine, event_id, 'originalLogin')
