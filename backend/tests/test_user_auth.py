from contextlib import ExitStack
from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.models import AuditEvent
from app.main import create_app
from app.user_auth.models import AuthenticationKey, UserRefreshToken
from app.user_auth.service import ACCESS_COOKIE, REFRESH_COOKIE, utcnow


PATIENT = {'first_name': 'Иван', 'last_name': 'Петров', 'date_of_birth': '1990-01-02', 'administrative_sex': 'М'}
ROLES = ['doctor', 'nurse', 'laboratory-technician', 'other']


@pytest.fixture
def employees(client, database_engine):
    with ExitStack() as stack:
        counter = 0
        def create(role='doctor', existing=None):
            nonlocal counter
            counter += 1
            if existing is None:
                worker = client.post('/api/medical-workers', json={
                    'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Медработник', 'role': role,
                }).json()
                result = client.post(f'/api/medical-workers/{worker["id"]}/account', json={'username': f'user{counter}'}).json()
                account, password = result['account'], result['password']
            else:
                worker, account, password = existing
            employee = stack.enter_context(TestClient(create_app(database_engine)))
            response = employee.post('/api/user-auth/login', json={'username': account['username'], 'password': password})
            assert response.status_code == 200, response.text
            return employee, worker, account, password
        yield create


def test_anonymous_and_admin_sessions_cannot_enter_medical_interface(client, database_engine):
    with TestClient(create_app(database_engine)) as anonymous:
        for path in ['/api/patients', '/api/patients/1', '/api/patients/1/medical-record', '/api/patients/1/medical-record/history']:
            assert anonymous.get(path).status_code == 401
            assert client.get(path).status_code == 401


@pytest.mark.parametrize('role', ROLES)
def test_creation_roles_and_server_derived_author(client, employees, role):
    doctor, _, _, _ = employees('doctor')
    patient = doctor.post('/api/patients', json=PATIENT).json()
    employee, worker, account, _ = employees(role)
    permitted = role in ('doctor', 'nurse')
    assert employee.post('/api/patients', json=PATIENT).status_code == (201 if permitted else 403)
    url = f'/api/patients/{patient["id"]}/medical-record'
    response = employee.post(url, json={})
    assert response.status_code == (201 if permitted else 403)
    if permitted:
        assert response.json()['edited_by']['id'] == worker['id']
        events = client.get('/api/audit').json()
        event = next(event for event in events if event['message'].startswith('Создана ЭМК'))
        assert event['actor'] == f'account:{account["id"]}'
    assert employee.get('/api/accounts').status_code == 401
    assert employee.get('/api/audit').status_code == 401
    assert employee.get('/api/diagnoses').status_code == 200
    assert employee.post('/api/diagnoses', json={'code': 'TEST', 'name': 'Пример'}).status_code == 403


@pytest.mark.parametrize('role', ROLES)
def test_any_role_can_read_but_only_doctor_unlocks_and_edits(employees, role):
    doctor, doctor_worker, _, _ = employees('doctor')
    patient = doctor.post('/api/patients', json=PATIENT).json()
    url = f'/api/patients/{patient["id"]}/medical-record'
    assert doctor.post(url, json={}).status_code == 201
    employee, worker, _, _ = employees(role)
    assert employee.get('/api/patients').status_code == 200
    assert employee.get(url).status_code == 200
    assert employee.get(url + '/history').status_code == 200
    response = employee.post(url + '/unlock')
    assert response.status_code == (200 if role == 'doctor' else 403)
    payload = {'version': 1, 'diagnosis_ids': [], 'prescriptions': []}
    if role == 'doctor':
        assert employee.put(url, json=payload).status_code == 422
        grant = response.json()['edit_token']
        saved = employee.put(url, json={**payload, 'edit_token': grant})
        assert saved.status_code == 200
        assert saved.json()['edited_by']['id'] == worker['id']
        assert employee.put(url, json={**payload, 'version': 2, 'edit_token': grant}).status_code == 403
    else:
        grant = doctor.post(url + '/unlock').json()['edit_token']
        assert employee.put(url, json={**payload, 'edit_token': grant}).status_code == 403
    # Manual authors are forbidden even when the caller otherwise has sufficient rights.
    assert doctor.post(url, json={'worker_id': worker['id']}).status_code == 422


def test_login_errors_are_audited_and_never_echo_password(client, database_engine, employees):
    employee, worker, account, password = employees()
    with TestClient(create_app(database_engine)) as stranger:
        response = stranger.post('/api/user-auth/login', json={'username': account['username'], 'password': 'wrong'})
        assert response.status_code == 401
        response = stranger.post('/api/user-auth/login', json={'username': account['username']})
        assert response.status_code == 422
        client.patch(f'/api/accounts/{account["id"]}', json={'is_active': False})
        assert stranger.post('/api/user-auth/login', json={'username': account['username'], 'password': password}).status_code == 401
    entries = client.get('/api/audit').json()
    assert sum('Неуспешная попытка входа пользователя' in event['message'] for event in entries) == 3
    assert all(password not in event['message'] for event in entries)


def test_jwt_refresh_rotation_logout_and_type_signature_validation(employees, database_engine):
    employee, _, _, _ = employees()
    old_access = employee.cookies.get(ACCESS_COOKIE)
    old_refresh = employee.cookies.get(REFRESH_COOKIE)
    assert len(old_access.split('.')) == 3 and len(old_refresh.split('.')) == 3
    assert employee.post('/api/user-auth/refresh').status_code == 200
    assert employee.cookies.get(REFRESH_COOKIE) != old_refresh
    assert employee.post('/api/user-auth/refresh', headers={'Cookie': f'{REFRESH_COOKIE}={old_refresh}'}).status_code == 401
    assert employee.get('/api/patients').status_code == 200
    assert employee.get('/api/patients', headers={'Cookie': f'{ACCESS_COOKIE}={old_refresh}'}).status_code == 401
    assert employee.get('/api/patients', headers={'Cookie': f'{ACCESS_COOKIE}={old_access[:-8]}tampered'}).status_code == 401
    with Session(database_engine) as session:
        key = session.get(AuthenticationKey, 1)
        assert jwt.get_unverified_header(employee.cookies.get(ACCESS_COOKIE))['alg'] == 'EdDSA'
        claims = jwt.decode(employee.cookies.get(ACCESS_COOKIE), key.public_key, algorithms=['EdDSA'], audience='PsychosIS-medical-worker')
        claims['exp'] = utcnow() - timedelta(seconds=1)
        expired = jwt.encode(claims, key.private_key, algorithm='EdDSA')
    assert employee.get('/api/patients', headers={'Cookie': f'{ACCESS_COOKIE}={expired}'}).status_code == 401
    current_access = employee.cookies.get(ACCESS_COOKIE)
    assert employee.post('/api/user-auth/logout').status_code == 204
    assert employee.get('/api/patients', headers={'Cookie': f'{ACCESS_COOKIE}={current_access}'}).status_code == 401


def test_unlocked_record_survives_rotation_but_not_another_login(employees):
    doctor, worker, account, password = employees()
    patient = doctor.post('/api/patients', json=PATIENT).json()
    url = f"/api/patients/{patient['id']}/medical-record"
    assert doctor.post(url, json={}).status_code == 201
    grant = doctor.post(url + '/unlock').json()
    old_access = doctor.cookies.get(ACCESS_COOKIE)
    old_sid = jwt.decode(old_access, options={'verify_signature': False})['sid']
    for _ in range(3):
        assert doctor.post('/api/user-auth/refresh').status_code == 200
        claims = jwt.decode(doctor.cookies.get(ACCESS_COOKIE), options={'verify_signature': False})
        assert claims['sid'] == old_sid
    assert doctor.get('/api/patients', headers={'Cookie': f'{ACCESS_COOKIE}={old_access}'}).status_code == 401
    other_login, _, _, _ = employees(existing=(worker, account, password))
    payload = {'edit_token': grant['edit_token'], 'version': grant['version'], 'diagnosis_ids': [], 'prescriptions': []}
    assert other_login.put(url, json=payload).status_code == 403
    assert doctor.put(url, json=payload).status_code == 200
    assert doctor.put(url, json=payload).status_code == 409


def test_session_family_migration_preserves_existing_session(employees, database_engine):
    from sqlalchemy import text
    from app.schema import initialize_database
    doctor, _, _, _ = employees()
    patient = doctor.post('/api/patients', json=PATIENT).json()
    url = f"/api/patients/{patient['id']}/medical-record"
    doctor.post(url, json={})
    grant = doctor.post(url + '/unlock').json()
    with database_engine.begin() as connection:
        connection.execute(text('ALTER TABLE user_refresh_tokens DROP COLUMN family_id'))
    initialize_database(database_engine)
    initialize_database(database_engine)
    assert doctor.get('/api/patients').status_code == 200
    assert doctor.post('/api/user-auth/refresh').status_code == 200
    assert doctor.put(url, json={'edit_token': grant['edit_token'], 'version': grant['version'],
                                'diagnosis_ids': [], 'prescriptions': []}).status_code == 200


@pytest.mark.parametrize('change', ['deactivated', 'password_changed', 'role_changed', 'logout'])
def test_record_grant_does_not_bypass_revocation(client, employees, change):
    doctor, worker, account, password = employees()
    patient = doctor.post('/api/patients', json=PATIENT).json()
    url = f"/api/patients/{patient['id']}/medical-record"
    doctor.post(url, json={})
    grant = doctor.post(url + '/unlock').json()
    assert doctor.post('/api/user-auth/refresh').status_code == 200
    if change == 'deactivated':
        client.patch(f"/api/accounts/{account['id']}", json={'is_active': False})
    elif change == 'password_changed':
        client.post(f"/api/medical-workers/{worker['id']}/account/reset-password")
    elif change == 'role_changed':
        client.put(f"/api/medical-workers/{worker['id']}", json={
            'first_name': worker['first_name'], 'last_name': worker['last_name'],
            'position': worker['position'], 'role': 'nurse'})
    else:
        doctor.post('/api/user-auth/logout')
    payload = {'edit_token': grant['edit_token'], 'version': grant['version'], 'diagnosis_ids': [], 'prescriptions': []}
    assert doctor.put(url, json=payload).status_code == 401
    if change == 'logout':
        assert doctor.post('/api/user-auth/login', json={'username': account['username'], 'password': password}).status_code == 200
        assert doctor.put(url, json=payload).status_code == 403


@pytest.mark.parametrize('change', ['deactivated', 'password_changed', 'role_changed', 'worker_deleted'])
def test_security_changes_revoke_all_refresh_tokens_and_audit_count(client, employees, database_engine, change):
    first, worker, account, password = employees()
    second, _, _, _ = employees(existing=(worker, account, password))
    old_access = first.cookies.get(ACCESS_COOKIE)
    if change == 'deactivated':
        assert client.patch(f'/api/accounts/{account["id"]}', json={'is_active': False}).status_code == 200
    elif change == 'password_changed':
        assert client.post(f'/api/medical-workers/{worker["id"]}/account/reset-password').status_code == 200
    elif change == 'role_changed':
        assert client.put(f'/api/medical-workers/{worker["id"]}', json={
            'first_name': worker['first_name'], 'last_name': worker['last_name'], 'position': worker['position'], 'role': 'nurse',
        }).status_code == 200
    else:
        assert client.delete(f'/api/medical-workers/{worker["id"]}').status_code == 204
    assert first.get('/api/patients', headers={'Cookie': f'{ACCESS_COOKIE}={old_access}'}).status_code == 401
    assert first.post('/api/user-auth/refresh').status_code == 401
    assert second.post('/api/user-auth/refresh').status_code == 401
    with Session(database_engine) as session:
        tokens = list(session.scalars(select(UserRefreshToken).where(UserRefreshToken.account_id == account['id'])))
        assert len(tokens) == 2 and all(token.revoked_at is not None for token in tokens)
        entries = list(session.scalars(select(AuditEvent)))
        assert sum('отозвано refresh-токенов: 2;' in event.message for event in entries) == 1
