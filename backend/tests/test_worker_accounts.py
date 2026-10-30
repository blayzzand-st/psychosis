from concurrent.futures import ThreadPoolExecutor
import re

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.accounts.passwords import generate_password, verify_password
from app.audit.models import AuditEvent
from app.medical_workers.models import MedicalWorker
from app.schema import initialize_database


WORKER = {'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач'}


@pytest.fixture
def account_url(client):
    worker = client.post('/api/medical-workers', json=WORKER).json()
    return f"/api/medical-workers/{worker['id']}/account"


def assert_password(password):
    assert re.fullmatch(r'[A-Za-z0-9]{12}', password)
    assert any(char.islower() for char in password)
    assert any(char.isupper() for char in password)
    assert any(char.isdigit() for char in password)


def test_generation_uses_required_alphabet_and_length():
    for _ in range(30):
        assert_password(generate_password())


def test_create_reset_status_and_safe_reads(client, database_engine, account_url):
    assert client.get(account_url).json() is None
    response = client.post(account_url, json={'username': ' doctor '})
    assert response.status_code == 201
    assert response.headers['cache-control'] == 'no-store'
    credentials = response.json()
    first = credentials['password']
    assert_password(first)
    account = credentials['account']
    assert account['username'] == 'doctor' and account['is_active'] is True
    assert client.get(account_url).json() == account
    assert 'password' not in client.get('/api/accounts').text
    with Session(database_engine) as session:
        stored = session.scalar(select(UserAccount))
        assert stored.password_hash.startswith('$argon2id$')
        assert verify_password(first, stored.password_hash)
        assert first not in stored.password_hash
    reset = client.post(account_url + '/reset-password')
    assert reset.status_code == 200
    assert reset.headers['cache-control'] == 'no-store'
    second = reset.json()['password']
    assert_password(second)
    assert first != second
    with Session(database_engine) as session:
        stored = session.scalar(select(UserAccount))
        assert stored.password_hash.startswith('$argon2id$')
        assert verify_password(second, stored.password_hash)
        assert not verify_password(first, stored.password_hash)
    for active in [False, False, True]:
        result = client.patch(account_url, json={'is_active': active})
        assert result.status_code == 200
        assert result.json()['is_active'] is active
        assert 'password' not in result.text
    with Session(database_engine) as session:
        messages = '\n'.join(session.scalars(select(AuditEvent.message)))
        assert first not in messages and second not in messages
        assert len(list(session.scalars(select(AuditEvent)))) == 7  # Includes password/deactivation token revocations.
        assert messages.count('отозвано refresh-токенов: 0;') == 2


def test_duplicate_username_and_duplicate_worker_rejected(client, account_url):
    assert client.post(account_url, json={'username': 'doctor'}).status_code == 201
    assert client.post(account_url, json={'username': 'another'}).status_code == 409
    other = client.post('/api/medical-workers', json=WORKER).json()
    other_url = f"/api/medical-workers/{other['id']}/account"
    assert client.post(other_url, json={'username': 'doctor'}).status_code == 409
    assert client.get(other_url).json() is None
    assert len(client.get('/api/accounts').json()) == 1


@pytest.mark.parametrize('payload', [
    {'username': 'ab'}, {'username': 'x' * 17}, {'username': '   '},
    {'username': 'doctor', 'medical_worker_id': 99},
    {'username': 'doctor', 'password': 'Secret123456'},
    {'username': 'doctor', 'is_active': True},
])
def test_creation_accepts_only_valid_username(client, account_url, payload):
    assert client.post(account_url, json=payload).status_code == 422
    assert client.get(account_url).json() is None


def test_no_standalone_creation_or_reassignment(client, account_url):
    assert client.post('/api/accounts', json={'username': 'alone'}).status_code == 405
    assert client.post(account_url, json={'username': 'doctor'}).status_code == 201
    for payload in [{'is_active': 'yes'}, {'is_active': True, 'medical_worker_id': None}, {'is_active': True, 'username': 'changed'}]:
        assert client.patch(account_url, json=payload).status_code == 422


def test_deleted_worker_deactivates_account_and_restore_does_not_activate_it(client, account_url):
    client.post(account_url, json={'username': 'doctor'})
    worker_url = account_url.removesuffix('/account')
    assert client.delete(worker_url).status_code == 204
    assert client.get(account_url).json()['is_active'] is False
    assert client.patch(account_url, json={'is_active': True}).status_code == 409
    assert client.post(account_url + '/reset-password').status_code == 409
    assert client.post(worker_url + '/restore').status_code == 200
    assert client.get(account_url).json()['is_active'] is False
    assert client.patch(account_url, json={'is_active': True}).json()['is_active'] is True


def test_cannot_create_for_deleted_or_missing_worker(client, account_url):
    client.delete(account_url.removesuffix('/account'))
    assert client.post(account_url, json={'username': 'doctor'}).status_code == 409
    assert client.post('/api/medical-workers/99999/account', json={'username': 'doctor'}).status_code == 404
    assert client.get('/api/medical-workers/99999/account').status_code == 404


def test_cannot_manage_nonexistent_account(client, account_url):
    assert client.patch(account_url, json={'is_active': True}).status_code == 404
    assert client.post(account_url + '/reset-password').status_code == 404


def test_concurrent_creation_still_creates_one_account(client, account_url):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda username: client.post(account_url, json={'username': username}).status_code,
                                ['doctor_one', 'doctor_two']))
    assert sorted(results) == [201, 409]
    assert len(client.get('/api/accounts').json()) == 1


@pytest.mark.parametrize('role', ['doctor', 'laboratory-technician', 'nurse', 'other'])
def test_worker_role_is_saved_and_not_reset_when_omitted(client, role):
    worker = client.post('/api/medical-workers', json=WORKER).json()
    assert worker['role'] == 'other'
    url = f"/api/medical-workers/{worker['id']}"
    assert client.put(url, json={**WORKER, 'role': role}).json()['role'] == role
    assert client.put(url, json=WORKER).json()['role'] == role
    assert client.get(url).json()['role'] == role
    assert client.put(url, json={**WORKER, 'role': 'admin'}).status_code == 422


def test_legacy_schema_upgrade_preserves_workers_and_is_repeatable(database_engine):
    with database_engine.begin() as c:
        c.execute(MedicalWorker.__table__.insert().values(**WORKER))
        c.execute(text('ALTER TABLE medical_workers DROP COLUMN role'))
    initialize_database(database_engine)
    initialize_database(database_engine)
    with Session(database_engine) as session:
        worker = session.scalar(select(MedicalWorker))
        assert worker.first_name == WORKER['first_name']
        assert worker.role == 'other'
        with pytest.raises(IntegrityError):
            session.execute(text("UPDATE medical_workers SET role = 'admin'"))


def test_name_constraints_migrate_and_signing_keys_survive_restart(database_engine):
    from app.user_auth.models import AuthenticationKey
    with database_engine.begin() as connection:
        for field in ('first_name', 'last_name'):
            connection.execute(text(f'ALTER TABLE medical_workers DROP CONSTRAINT ck_medical_workers_{field}_length'))
            connection.execute(text(f'ALTER TABLE medical_workers ADD CONSTRAINT ck_medical_workers_{field}_length CHECK (length({field}) BETWEEN 3 AND 24)'))
    initialize_database(database_engine)
    with Session(database_engine) as session:
        private_key = session.get(AuthenticationKey, 1).private_key
        session.add(MedicalWorker(first_name='Я', last_name='Ли', position='Врач'))
        session.commit()
    initialize_database(database_engine)
    with Session(database_engine) as session:
        assert session.get(AuthenticationKey, 1).private_key == private_key
        assert session.scalar(select(MedicalWorker)).first_name == 'Я'
