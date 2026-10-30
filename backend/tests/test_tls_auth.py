from fastapi.testclient import TestClient

from app.admin_auth.totp import totp
from app.main import create_app


def assert_secure_cookies(response, expected):
    cookies = response.headers.get_list('set-cookie')
    for name in expected:
        cookie = next(value for value in cookies if value.startswith(name + '='))
        assert '; Secure' in cookie and '; HttpOnly' in cookie and 'SameSite=strict' in cookie


def test_admin_https_setup_secure_cookie_and_origin(database_engine, monkeypatch):
    monkeypatch.setattr('app.admin_auth.totp.current_step', lambda: 60_000_000)
    with TestClient(create_app(database_engine), base_url='https://localhost:5173') as client:
        payload = {'password': 'TLS-test-password', 'password_confirmation': 'TLS-test-password'}
        assert client.post('/api/admin-auth/setup/start', json=payload,
                           headers={'Origin': 'http://localhost:5173'}).status_code == 403
        start = client.post('/api/admin-auth/setup/start', json=payload,
                            headers={'Origin': 'https://localhost:5173'})
        assert start.status_code == 200
        assert_secure_cookies(start, ['psychosis_admin_setup'])
        complete = client.post('/api/admin-auth/setup/complete',
                               json={'code': totp(start.json()['totp_secret'], 60_000_000)},
                               headers={'Origin': 'https://localhost:5173'})
        assert complete.status_code == 200
        assert_secure_cookies(complete, ['psychosis_admin_session'])
        assert client.get('/api/audit').status_code == 200


def test_employee_https_access_and_refresh_cookies(client, database_engine):
    worker = client.post('/api/medical-workers', json={
        'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач', 'role': 'doctor',
    }).json()
    account = client.post(f'/api/medical-workers/{worker["id"]}/account', json={'username': 'tlsDoctor'}).json()
    with TestClient(create_app(database_engine), base_url='https://localhost:5173') as employee:
        login = employee.post('/api/user-auth/login', json={
            'username': 'tlsDoctor', 'password': account['password'],
        }, headers={'Origin': 'https://localhost:5173'})
        assert login.status_code == 200
        assert_secure_cookies(login, ['psychosis_user_access', 'psychosis_user_refresh'])
        assert employee.get('/api/patients').status_code == 200
        refresh = employee.post('/api/user-auth/refresh', headers={'Origin': 'https://localhost:5173'})
        assert refresh.status_code == 200
        assert_secure_cookies(refresh, ['psychosis_user_access', 'psychosis_user_refresh'])
