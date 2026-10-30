from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.medical_workers.models import MedicalWorker


def test_empty_account_list(client):
    assert client.get('/api/accounts').json() == []


def test_account_list_includes_status_worker_and_dates_without_hash(client, database_engine):
    with Session(database_engine) as session:
        worker = MedicalWorker(first_name='Иван', last_name='Петров', position='Врач', is_deleted=True)
        session.add(worker)
        session.flush()
        linked = UserAccount(username='worker', password_hash='never-return-this-hash', medical_worker_id=worker.id, is_active=False)
        standalone = UserAccount(username='independent', password_hash='another-secret-hash')
        session.add_all([linked, standalone])
        session.commit()
        worker_id = worker.id
    response = client.get('/api/accounts')
    assert response.status_code == 200
    accounts = response.json()
    assert [account['username'] for account in accounts] == ['independent', 'worker']
    assert accounts[0]['medical_worker'] is None
    assert accounts[0]['is_active'] is True
    assert accounts[1]['medical_worker'] == {'id': worker_id, 'first_name': 'Иван', 'last_name': 'Петров', 'is_deleted': True}
    assert accounts[1]['is_active'] is False
    for account in accounts:
        assert set(account) == {'id', 'username', 'created_at', 'updated_at', 'is_active', 'medical_worker_id', 'medical_worker'}
        assert account['created_at'] and account['updated_at']
    assert 'hash' not in response.text
