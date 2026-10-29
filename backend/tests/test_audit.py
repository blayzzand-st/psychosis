from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.models import AuditEvent
from app.audit.schemas import AuditEventRead
from app.audit.service import append_audit_event


@pytest.mark.parametrize("actor", [f"account:{uuid4()}", f"anonymous:{uuid4()}", "system:startup"])
def test_append_and_read(database_engine, actor):
    with Session(database_engine) as session:
        entry = append_audit_event(session, actor=actor, message="Событие зарегистрировано")
        session.commit()
        session.refresh(entry)
        assert isinstance(entry.event_id, UUID)
        assert entry.event_time is not None
        result = AuditEventRead.model_validate(entry)
        assert result.actor == actor
        assert result.message == "Событие зарегистрировано"


@pytest.mark.parametrize("actor", ["Иван", "account:doctor", "anonymous", "system:", "account:" + "x" * 36])
def test_invalid_actor_rejected(database_engine, actor):
    with Session(database_engine) as session:
        with pytest.raises(ValidationError):
            append_audit_event(session, actor=actor, message="Описание")


def test_empty_message_rejected_by_service_and_database(database_engine):
    with Session(database_engine) as session:
        with pytest.raises(ValueError):
            append_audit_event(session, actor="system:test", message="  ")
        session.add(AuditEvent(actor="system:test", message="  "))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("operation", ["update", "delete"])
def test_orm_cannot_modify_history(database_engine, operation):
    with Session(database_engine) as session:
        entry = append_audit_event(session, actor="system:test", message="Оригинал")
        session.commit()
        entry_id = entry.event_id
        if operation == "update":
            entry.message = "Подмена"
        else:
            session.delete(entry)
        with pytest.raises(ValueError, match="cannot be changed or deleted"):
            session.commit()
        session.rollback()
        assert session.get(AuditEvent, entry_id).message == "Оригинал"


def test_audit_participates_in_callers_transaction(database_engine):
    with Session(database_engine) as session:
        append_audit_event(session, actor="system:test", message="Отменённая операция")
        session.flush()
        session.rollback()
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 0
