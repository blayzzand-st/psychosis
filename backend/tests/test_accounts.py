from uuid import UUID

import pytest
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.accounts.passwords import hash_password, verify_password
from app.accounts.schemas import UserAccountRead
from app.medical_workers.models import MedicalWorker


def test_password_hash_is_salted_and_verifiable():
    first = hash_password("Abc123Secret")
    assert first != hash_password("Abc123Secret")
    assert "Abc123Secret" not in first
    assert verify_password("Abc123Secret", first)
    assert not verify_password("wrong", first)
    assert not verify_password("Abc123Secret", "broken")
    assert not verify_password("Abc123Secret", first.replace("16384", "999999999"))


def test_account_defaults_update_and_safe_response(database_engine):
    with Session(database_engine) as session:
        account = UserAccount(username="doctor", password_hash=hash_password("Secret123"))
        session.add(account)
        session.commit()
        assert isinstance(account.id, UUID)
        assert account.is_active
        assert account.medical_worker_id is None
        created = account.created_at
        updated = account.updated_at
        account.is_active = False
        session.commit()
        session.refresh(account)
        assert account.created_at == created
        assert account.updated_at > updated
        assert "password_hash" not in UserAccountRead.model_validate(account).model_dump()


@pytest.mark.parametrize("username,error", [("ab", IntegrityError), ("x" * 17, DataError)])
def test_database_rejects_invalid_username(database_engine, username, error):
    with Session(database_engine) as session:
        session.add(UserAccount(username=username, password_hash="hash"))
        with pytest.raises(error):
            session.commit()


def test_unique_username_and_worker_link(database_engine):
    with Session(database_engine) as session:
        worker = MedicalWorker(first_name="Иван", last_name="Петров", position="Врач")
        session.add(worker)
        session.flush()
        session.add(UserAccount(username="doctor", password_hash="hash", medical_worker_id=worker.id))
        session.commit()
        worker_id = worker.id
        session.add(UserAccount(username="doctor", password_hash="hash"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
        session.add(UserAccount(username="nurse", password_hash="hash", medical_worker_id=worker_id))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
        session.add(UserAccount(username="other", password_hash="hash", medical_worker_id=999999))
        with pytest.raises(IntegrityError):
            session.commit()
