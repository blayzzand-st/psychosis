import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.admin_auth.models import Administrator, AdministratorSession, AdministratorSetup
from app.admin_auth.service import SESSION_COOKIE, utcnow
from app.admin_auth.totp import totp, verify_totp
from app.audit.models import AuditEvent
from app.main import create_app


PASSWORD = 'TestAdminPassword-6238'
STEP = 60_000_000
AUTH = '/api/admin-auth'


@pytest.fixture
def auth_client(database_engine, monkeypatch):
    monkeypatch.setattr('app.admin_auth.totp.current_step', lambda: STEP)
    with TestClient(create_app(database_engine)) as client:
        yield client


def start(client):
    response = client.post(AUTH + '/setup/start', json={'password': PASSWORD, 'password_confirmation': PASSWORD})
    assert response.status_code == 200
    return response.json()['totp_secret']


def configured(client):
    secret = start(client)
    response = client.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)})
    assert response.status_code == 200
    return secret


def test_delete_admin_preserves_data_revokes_all_sessions_and_allows_new_setup(auth_client, database_engine, monkeypatch):
    from app.admin_auth.service import REFRESH_COOKIE
    from app.medical_workers.models import MedicalWorker
    from app.patients.models import Patient
    secret = configured(auth_client)
    worker = auth_client.post('/api/medical-workers', json={
        'first_name': 'Я', 'last_name': 'Ли', 'position': 'Врач', 'role': 'doctor',
    }).json()
    credentials = auth_client.post(f"/api/medical-workers/{worker['id']}/account", json={'username': 'keptDoctor'}).json()
    with TestClient(create_app(database_engine)) as employee, TestClient(create_app(database_engine)) as second:
        employee.post('/api/user-auth/login', json={'username': 'keptDoctor', 'password': credentials['password']})
        patient = employee.post('/api/patients', json={
            'first_name': 'Анна', 'last_name': 'Петрова', 'date_of_birth': '1990-01-01', 'administrative_sex': 'Ж',
        }).json()
        record_url = f"/api/patients/{patient['id']}/medical-record"
        record = employee.post(record_url, json={})
        assert record.status_code == 201
        assert employee.request('DELETE', AUTH + '/account', json={
            'password': PASSWORD, 'code': totp(secret, STEP + 1), 'confirmation': 'УДАЛИТЬ'}).status_code == 401
        assert second.post(AUTH + '/login', json={'password': PASSWORD, 'code': totp(secret, STEP + 1)}).status_code == 200
        old_access = auth_client.cookies.get(SESSION_COOKIE)
        second_access = second.cookies.get(SESSION_COOKIE)
        old_refresh = second.cookies.get(REFRESH_COOKIE)
        with Session(database_engine) as session:
            old_id = session.get(Administrator, 1).account_id
            before_audit = session.scalar(select(func.count()).select_from(AuditEvent))
        monkeypatch.setattr('app.admin_auth.totp.current_step', lambda: STEP + 1)
        result = auth_client.request('DELETE', AUTH + '/account', json={
            'password': PASSWORD, 'code': totp(secret, STEP + 2), 'confirmation': 'УДАЛИТЬ'})
        assert result.status_code == 204
        assert auth_client.get(AUTH + '/status').json()['configured'] is False
        for access in (old_access, second_access):
            assert second.get('/api/audit', headers={'Cookie': f'{SESSION_COOKIE}={access}'}).status_code == 401
        assert second.post(AUTH + '/refresh', headers={'Cookie': f'{REFRESH_COOKIE}={old_refresh}'}).status_code == 401
        assert employee.get(f"/api/patients/{patient['id']}").status_code == 200
        assert employee.get(record_url).json() == record.json()
        with Session(database_engine) as session:
            assert session.get(Administrator, 1) is None
            assert session.scalar(select(func.count()).select_from(AdministratorSession)) == 0
            assert session.get(MedicalWorker, worker['id']) is not None
            assert session.get(Patient, patient['id']) is not None
            assert session.scalar(select(func.count()).select_from(AuditEvent)) == before_audit + 1
            event = session.scalar(select(AuditEvent).where(AuditEvent.message.startswith('Удалён администратор')))
            assert event.actor == f'account:{old_id}' and event.actor_label == 'Администратор'
        new_secret = start(auth_client)
        assert new_secret != secret
        assert auth_client.post(AUTH + '/setup/complete', json={'code': totp(new_secret, STEP + 1)}).status_code == 200
        with Session(database_engine) as session:
            assert session.get(Administrator, 1).account_id != old_id
        assert auth_client.get('/api/audit').status_code == 200
        assert second.get('/api/accounts', headers={'Cookie': f'{SESSION_COOKIE}={old_access}'}).status_code == 401


def test_delete_admin_requires_auth_confirmation_password_and_fresh_totp(auth_client, database_engine):
    secret = configured(auth_client)
    payload = {'password': PASSWORD, 'code': totp(secret, STEP + 1), 'confirmation': 'УДАЛИТЬ'}
    with TestClient(create_app(database_engine)) as anonymous:
        assert anonymous.request('DELETE', AUTH + '/account', json=payload).status_code == 401
    assert auth_client.request('DELETE', AUTH + '/account', json={**payload, 'confirmation': 'yes'}).status_code == 422
    assert auth_client.request('DELETE', AUTH + '/account', json={**payload, 'password': 'wrong'}).status_code == 401
    assert auth_client.request('DELETE', AUTH + '/account', json={**payload, 'code': totp(secret, STEP)}).status_code == 401
    assert auth_client.request('DELETE', AUTH + '/account', json=payload, headers={'Origin': 'https://other.invalid'}).status_code == 403
    assert auth_client.get(AUTH + '/status').json()['authenticated'] is True
    with Session(database_engine) as session:
        assert session.get(Administrator, 1) is not None
        assert session.scalar(select(func.count()).select_from(AuditEvent).where(
            AuditEvent.message == 'Неуспешная попытка удаления администратора')) == 2


def test_delete_and_refresh_race_cannot_keep_admin_authenticated(auth_client, database_engine):
    secret = configured(auth_client)
    cookies = dict(auth_client.cookies)
    with TestClient(create_app(database_engine), cookies=cookies) as refreshing:
        with ThreadPoolExecutor(max_workers=2) as pool:
            reset = pool.submit(auth_client.request, 'DELETE', AUTH + '/account', json={
                'password': PASSWORD, 'code': totp(secret, STEP + 1), 'confirmation': 'УДАЛИТЬ'})
            rotation = pool.submit(refreshing.post, AUTH + '/refresh')
            assert reset.result().status_code == 204
            assert rotation.result().status_code in (200, 401)
        assert refreshing.get('/api/accounts').status_code == 401
        assert refreshing.post(AUTH + '/refresh').status_code == 401


def test_admin_asymmetric_pair_rotation_and_token_separation(auth_client, database_engine):
    import jwt
    from app.admin_auth.service import REFRESH_COOKIE
    from app.user_auth.models import AuthenticationKey
    from app.tokens import ADMIN_AUDIENCE, WORKER_AUDIENCE
    configured(auth_client)
    access = auth_client.cookies.get(SESSION_COOKIE)
    refresh = auth_client.cookies.get(REFRESH_COOKIE)
    with Session(database_engine) as session:
        key = session.get(AuthenticationKey, 1)
        claims = jwt.decode(access, key.public_key, algorithms=['EdDSA'], audience=ADMIN_AUDIENCE)
        refresh_claims = jwt.decode(refresh, key.public_key, algorithms=['EdDSA'], audience=ADMIN_AUDIENCE)
        assert claims['typ'] == 'access' and refresh_claims['typ'] == 'refresh'
        assert claims['jti'] == refresh_claims['jti']
        assert claims['exp'] < refresh_claims['exp']
        wrong_audience = jwt.encode({**claims, 'aud': WORKER_AUDIENCE}, key.private_key, algorithm='EdDSA')
        symmetric = jwt.encode(claims, key.secret, algorithm='HS256')
        expired = jwt.encode({**claims, 'exp': utcnow() - timedelta(seconds=1)}, key.private_key, algorithm='EdDSA')
    for invalid in (refresh, wrong_audience, symmetric, expired, access[:-10] + 'tampered'):
        assert auth_client.get('/api/accounts', headers={'Cookie': f'{SESSION_COOKIE}={invalid}'}).status_code == 401
    assert auth_client.post(AUTH + '/refresh').status_code == 200
    assert auth_client.cookies.get(SESSION_COOKIE) != access
    assert auth_client.cookies.get(REFRESH_COOKIE) != refresh
    assert auth_client.get('/api/accounts', headers={'Cookie': f'{SESSION_COOKIE}={access}'}).status_code == 401
    assert auth_client.post(AUTH + '/refresh', headers={'Cookie': f'{REFRESH_COOKIE}={refresh}'}).status_code == 401
    assert auth_client.get('/api/accounts').status_code == 200
    latest_refresh = auth_client.cookies.get(REFRESH_COOKIE)
    auth_client.post(AUTH + '/logout', json={})
    assert auth_client.post(AUTH + '/refresh', headers={'Cookie': f'{REFRESH_COOKIE}={latest_refresh}'}).status_code == 401


@pytest.mark.parametrize(('seconds', 'expected'), [
    (59, '94287082'), (1111111109, '07081804'), (1111111111, '14050471'),
    (1234567890, '89005924'), (2000000000, '69279037'), (20000000000, '65353130'),
])
def test_rfc6238_sha1_vectors(seconds, expected):
    secret = base64.b32encode(b'12345678901234567890').decode()
    assert totp(secret, seconds // 30, digits=8) == expected


def test_clock_window_and_replay_rules():
    secret = 'JBSWY3DPEHPK3PXP'
    for offset in (-1, 0, 1):
        code = totp(secret, STEP + offset)
        assert verify_totp(secret, code, now=STEP * 30) == STEP + offset
        assert verify_totp(secret, code, last_step=STEP + offset, now=STEP * 30) is None
    for code in ('', '１２３４５６', '12345', '1234567', 'abcdef', totp(secret, STEP - 2)):
        assert verify_totp(secret, code, now=STEP * 30) is None


@pytest.mark.parametrize('path', ['/api/audit', '/api/audit/stream', '/api/accounts', '/api/medical-workers', '/api/diagnoses'])
def test_admin_api_is_closed_before_setup(auth_client, path):
    assert auth_client.get(path).status_code == 401
    status = auth_client.get(AUTH + '/status').json()
    assert status == dict(configured=False, authenticated=False, setup_pending=False,
                          totp_secret=None, setup_expires_at=None)


@pytest.mark.parametrize(('password', 'confirmation'), [('', ''), (PASSWORD, 'different-password'), ('x' * 129, 'x' * 129)])
def test_password_validation_does_not_start_setup(auth_client, database_engine, password, confirmation):
    response = auth_client.post(AUTH + '/setup/start', json={'password': password, 'password_confirmation': confirmation})
    assert response.status_code == 422
    assert PASSWORD not in response.text
    with Session(database_engine) as session:
        assert session.scalar(select(func.count()).select_from(AdministratorSetup)) == 0
        assert session.get(Administrator, 1) is None


def test_single_character_password_can_be_configured_and_used_to_log_in(auth_client):
    response = auth_client.post(AUTH + '/setup/start', json={'password': 'a', 'password_confirmation': 'a'})
    assert response.status_code == 200
    secret = response.json()['totp_secret']
    assert auth_client.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)}).status_code == 200
    auth_client.post(AUTH + '/logout', json={})
    assert auth_client.post(AUTH + '/login', json={'password': 'a', 'code': totp(secret, STEP + 1)}).status_code == 200


def test_setup_requires_verified_totp_and_does_not_expose_secret_afterwards(auth_client, database_engine):
    secret = start(auth_client)
    status = auth_client.get(AUTH + '/status').json()
    assert status['setup_pending'] and status['totp_secret'] == secret
    assert not status['configured'] and not status['authenticated']
    assert auth_client.get('/api/accounts').status_code == 401
    assert auth_client.post(AUTH + '/setup/complete', json={'code': 'invalid'}).status_code == 401
    with Session(database_engine) as session:
        assert session.get(Administrator, 1) is None
    response = auth_client.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)})
    assert response.status_code == 200
    cookie = response.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=strict' in cookie and 'path=/api' in cookie
    status = auth_client.get(AUTH + '/status').json()
    assert status['configured'] and status['authenticated']
    assert status['totp_secret'] is None and not status['setup_pending']
    assert auth_client.get('/api/accounts').status_code == 200
    assert auth_client.post(AUTH + '/setup/start', json={'password': PASSWORD, 'password_confirmation': PASSWORD}).status_code == 409
    assert auth_client.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP + 1)}).status_code == 409
    with Session(database_engine) as session:
        admin = session.get(Administrator, 1)
        assert admin.password_hash.startswith('$argon2id$') and PASSWORD not in admin.password_hash
        assert session.scalar(select(func.count()).select_from(AdministratorSetup)) == 0
        entries = list(session.scalars(select(AuditEvent)))
        assert len(entries) == 1 and entries[0].actor == f'account:{admin.account_id}'
        assert 'Успешный вход администратора' in entries[0].message
        assert secret not in entries[0].message


def test_setup_is_bound_to_browser_and_expires(auth_client, database_engine):
    secret = start(auth_client)
    with TestClient(create_app(database_engine)) as stranger:
        assert stranger.get(AUTH + '/status').json()['totp_secret'] is None
        assert stranger.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)}).status_code == 410
    with Session(database_engine) as session:
        setup = session.scalar(select(AdministratorSetup))
        setup.expires_at = utcnow() - timedelta(seconds=1)
        session.commit()
    assert auth_client.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)}).status_code == 410
    assert auth_client.get(AUTH + '/status').json()['setup_pending'] is False
    new_secret = start(auth_client)
    assert new_secret != secret
    assert auth_client.post(AUTH + '/setup/cancel', json={}).status_code == 204
    assert auth_client.get(AUTH + '/status').json()['setup_pending'] is False


def test_login_requires_both_factors_prevents_replay_and_audits_results(auth_client, database_engine):
    secret = configured(auth_client)
    assert auth_client.post(AUTH + '/logout', json={}).status_code == 204
    assert auth_client.get('/api/accounts').status_code == 401
    assert auth_client.post(AUTH + '/login', json={'password': PASSWORD}).status_code == 422
    assert auth_client.post(AUTH + '/login', json={'password': PASSWORD, 'code': totp(secret, STEP)}).status_code == 401
    assert auth_client.post(AUTH + '/login', json={'password': 'wrong-password', 'code': totp(secret, STEP + 1)}).status_code == 401
    response = auth_client.post(AUTH + '/login', json={'password': PASSWORD, 'code': totp(secret, STEP + 1)})
    assert response.status_code == 200
    assert auth_client.get('/api/accounts').status_code == 200
    with Session(database_engine) as session:
        entries = list(session.scalars(select(AuditEvent)))
        assert len(entries) == 5
        assert sum('Неуспешная попытка' in entry.message for entry in entries) == 3
        assert all(PASSWORD not in entry.message and secret not in entry.message for entry in entries)


def test_bruteforce_throttle_is_persisted_and_temporarily_expires(auth_client, database_engine):
    secret = configured(auth_client)
    auth_client.post(AUTH + '/logout', json={})
    for _ in range(5):
        assert auth_client.post(AUTH + '/login', json={'password': 'wrong', 'code': 'bad'}).status_code == 401
    response = auth_client.post(AUTH + '/login', json={'password': PASSWORD, 'code': totp(secret, STEP + 1)})
    assert response.status_code == 429 and response.headers['retry-after'] == '30'
    with Session(database_engine) as session:
        admin = session.get(Administrator, 1)
        admin.blocked_until = utcnow() - timedelta(seconds=1)
        session.commit()
    assert auth_client.post(AUTH + '/login', json={'password': PASSWORD, 'code': totp(secret, STEP + 1)}).status_code == 200


def test_session_revocation_expiration_and_cookie_tampering(auth_client, database_engine):
    configured(auth_client)
    token = auth_client.cookies.get(SESSION_COOKIE)
    auth_client.post(AUTH + '/logout', json={})
    assert auth_client.get('/api/accounts', headers={'Cookie': f'{SESSION_COOKIE}={token}'}).status_code == 401
    assert auth_client.get('/api/accounts', headers={'Cookie': f'{SESSION_COOKIE}=made-up'}).status_code == 401
    # A newly issued session is still subject to its server-side expiration time.
    with Session(database_engine) as session:
        row = session.scalar(select(AdministratorSession))
        row.revoked_at = None
        row.expires_at = utcnow() - timedelta(seconds=1)
        session.commit()
    assert auth_client.get('/api/accounts', headers={'Cookie': f'{SESSION_COOKIE}={token}'}).status_code == 401


def test_setup_and_sessions_survive_restart(auth_client, database_engine):
    secret = start(auth_client)
    with TestClient(create_app(database_engine), cookies=auth_client.cookies) as restarted:
        assert restarted.get(AUTH + '/status').json()['totp_secret'] == secret
        assert restarted.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)}).status_code == 200
        cookies = restarted.cookies
    with TestClient(create_app(database_engine), cookies=cookies) as restarted:
        assert restarted.get('/api/audit').status_code == 200
        assert restarted.get(AUTH + '/status').json()['authenticated']


def test_cross_origin_mutations_are_rejected(auth_client):
    configured(auth_client)
    response = auth_client.post(AUTH + '/logout', json={}, headers={'Origin': 'https://untrusted.example'})
    assert response.status_code == 403
    assert auth_client.get('/api/accounts').status_code == 200


def test_https_session_cookie_is_secure(database_engine, monkeypatch):
    monkeypatch.setattr('app.admin_auth.totp.current_step', lambda: STEP)
    with TestClient(create_app(database_engine), base_url='https://testserver') as client:
        secret = start(client)
        response = client.post(AUTH + '/setup/complete', json={'code': totp(secret, STEP)})
        cookies = response.headers.get_list('set-cookie')
        session_cookie = next(cookie for cookie in cookies if cookie.startswith(SESSION_COOKIE + '='))
        assert 'Secure' in session_cookie
        assert client.get('/api/accounts').status_code == 200


def test_parallel_initialization_can_create_only_one_administrator(auth_client, database_engine):
    first_secret = start(auth_client)
    with TestClient(create_app(database_engine)) as second:
        second_secret = start(second)
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(auth_client.post, AUTH + '/setup/complete', json={'code': totp(first_secret, STEP)})
            other = pool.submit(second.post, AUTH + '/setup/complete', json={'code': totp(second_secret, STEP)})
            assert sorted([first.result().status_code, other.result().status_code]) == [200, 409]
    with Session(database_engine) as session:
        assert session.scalar(select(func.count()).select_from(Administrator)) == 1
        assert session.scalar(select(func.count()).select_from(AdministratorSession)) == 1
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1
        admin = session.get(Administrator, 1)
        session.add(Administrator(id=2, password_hash=admin.password_hash, totp_secret=admin.totp_secret,
                                  last_totp_step=STEP, configured_at=utcnow()))
        with pytest.raises(IntegrityError):
            session.commit()
