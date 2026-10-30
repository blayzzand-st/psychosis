from uuid import UUID
import hashlib

from argon2 import Type, extract_parameters

import pytest
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.accounts.passwords import hash_password, verify_password
from app.accounts.schemas import UserAccountRead
from app.medical_workers.models import MedicalWorker


def test_password_hash_is_salted_and_verifiable():
    first = hash_password("Abc123Secret")
    assert first.startswith("$argon2id$v=19$m=65536,t=3,p=4$")
    parameters = extract_parameters(first)
    assert parameters.type == Type.ID
    assert parameters.salt_len == 16 and parameters.hash_len == 32
    assert first != hash_password("Abc123Secret")
    assert "Abc123Secret" not in first
    assert verify_password("Abc123Secret", first)
    assert not verify_password("wrong", first)
    assert not verify_password("Abc123Secret", "broken")
    assert not verify_password("Abc123Secret", first.replace("m=65536", "m=999999999"))
    assert not verify_password("Abc123Secret", "$argon2id$broken")


def test_legacy_scrypt_still_verifies_but_new_hashes_use_argon2id():
    password = "LegacySecret123"
    salt = bytes(range(16))
    digest = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    legacy = f"scrypt$16384$8$1${salt.hex()}${digest.hex()}"
    assert verify_password(password, legacy)
    assert not verify_password("wrong", legacy)
    assert not verify_password(password, legacy.replace("16384", "999999999"))
    assert hash_password(password).startswith("$argon2id$")


def test_empty_password_rejected():
    with pytest.raises(ValueError):
        hash_password("")


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
