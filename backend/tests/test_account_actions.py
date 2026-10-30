from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.audit.models import AuditEvent
from app.main import create_app
from fastapi.testclient import TestClient


def setup_account(client):
    worker = client.post('/api/medical-workers', json={'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач'}).json()
    account = client.post(f"/api/medical-workers/{worker['id']}/account", json={'username': 'doctor'}).json()['account']
    return worker, account


def test_quick_status_updates_are_persisted_and_do_not_expose_password(client):
    worker, account = setup_account(client)
    for active in [False, True]:
        response = client.patch(f"/api/accounts/{account['id']}", json={'is_active': active})
        assert response.status_code == 200
        assert response.json()['is_active'] is active
        assert 'password' not in response.text
        assert client.get(f"/api/medical-workers/{worker['id']}/account").json()['is_active'] is active
    assert client.patch(f"/api/accounts/{account['id']}", json={'is_active': True, 'medical_worker_id': None}).status_code == 422


def test_delete_preserves_worker_medical_history_and_audit_and_frees_username(client, clinical_client, database_engine):
    worker, account = setup_account(client)
    client.put(f'/api/medical-workers/{worker["id"]}', json={
        'first_name': worker['first_name'], 'last_name': worker['last_name'], 'position': worker['position'], 'role': 'doctor',
    })
    credentials = client.post(f'/api/medical-workers/{worker["id"]}/account/reset-password').json()
    with TestClient(create_app(database_engine)) as author:
        assert author.post('/api/user-auth/login', json={'username': account['username'], 'password': credentials['password']}).status_code == 200
        patient = author.post('/api/patients', json={'first_name': 'Анна', 'last_name': 'Петрова', 'date_of_birth': '1990-01-02', 'administrative_sex': 'Ж'}).json()
        chart_url = f"/api/patients/{patient['id']}/medical-record"
        assert author.post(chart_url, json={}).status_code == 201
        history = author.get(chart_url + '/history').json()
    url = f"/api/accounts/{account['id']}"
    response = client.delete(url)
    assert response.status_code == 204 and response.content == b''
    assert all(item['id'] != account['id'] for item in client.get('/api/accounts').json())
    assert client.get(f"/api/medical-workers/{worker['id']}").status_code == 200
    assert clinical_client.get(chart_url + '/history').json() == history
    assert client.get(f"/api/medical-workers/{worker['id']}/account").json() is None
    assert client.delete(url).status_code == 404
    with Session(database_engine) as session:
        messages = list(session.scalars(select(AuditEvent.message)))
        assert any('Удалён аккаунт ' + account['id'] in message for message in messages)
    recreated = client.post(f"/api/medical-workers/{worker['id']}/account", json={'username': 'doctor'})
    assert recreated.status_code == 201
    assert recreated.json()['account']['id'] != account['id']


def test_deleted_worker_cannot_be_activated_but_account_can_be_deleted(client):
    worker, account = setup_account(client)
    client.delete(f"/api/medical-workers/{worker['id']}")
    url = f"/api/accounts/{account['id']}"
    assert client.patch(url, json={'is_active': True}).status_code == 409
    assert client.patch(url, json={'is_active': False}).status_code == 200
    assert client.delete(url).status_code == 204


def test_existing_standalone_accounts_can_be_managed(client, database_engine):
    with Session(database_engine) as session:
        account = UserAccount(username='standalone', password_hash='test-only-hash')
        session.add(account)
        session.commit()
        account_id = account.id
    url = f'/api/accounts/{account_id}'
    assert client.patch(url, json={'is_active': False}).json()['is_active'] is False
    assert client.delete(url).status_code == 204


def test_unknown_and_invalid_ids(client):
    url = f'/api/accounts/{uuid4()}'
    assert client.delete(url).status_code == 404
    assert client.patch(url, json={'is_active': True}).status_code == 404
    assert client.delete('/api/accounts/invalid-id').status_code == 422
