"""Synchronous domain events: subscribers participate in the caller's transaction."""
from collections.abc import Callable
from contextvars import ContextVar
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from sqlalchemy.orm import Session


current_actor: ContextVar[str | None] = ContextVar("audit_actor", default=None)


class EventKind(StrEnum):
    WORKER_CREATED = "worker.created"
    WORKER_UPDATED = "worker.updated"
    WORKER_DELETED = "worker.deleted"
    WORKER_RESTORED = "worker.restored"
    WORKER_ROLE_CHANGED = "worker.role_changed"
    PATIENT_CREATED = "patient.created"
    PATIENT_UPDATED = "patient.updated"
    PATIENT_DELETED = "patient.deleted"
    RECORD_CREATED = "medical_record.created"
    RECORD_UPDATED = "medical_record.updated"
    ACCOUNT_CREATED = "account.created"
    ACCOUNT_PASSWORD_RESET = "account.password_reset"
    ACCOUNT_ACTIVATED = "account.activated"
    ACCOUNT_DEACTIVATED = "account.deactivated"
    ACCOUNT_DELETED = "account.deleted"
    ADMIN_LOGGED_IN = "auth.admin_logged_in"
    USER_LOGGED_IN = "auth.user_logged_in"
    ADMIN_LOGIN_FAILED = "auth.admin_login_failed"
    ADMIN_DELETED = "auth.admin_deleted"
    ADMIN_DELETE_FAILED = "auth.admin_delete_failed"
    USER_LOGIN_FAILED = "auth.user_login_failed"
    REFRESH_TOKENS_REVOKED = "auth.refresh_tokens_revoked"


@dataclass(frozen=True)
class DomainEvent:
    kind: EventKind
    actor: str
    entity_id: int | UUID | None = None
    worker_id: int | None = None
    patient_id: int | None = None
    version: int | None = None
    old_role: str | None = None
    new_role: str | None = None
    revoked_count: int | None = None
    reason: str | None = None


Handler = Callable[[Session, DomainEvent], None]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[EventKind, list[Handler]] = {}

    def subscribe(self, kind: EventKind, handler: Handler) -> None:
        handlers = self._handlers.setdefault(kind, [])
        if handler not in handlers:
            handlers.append(handler)

    def publish(self, session: Session, event: DomainEvent) -> None:
        for handler in self._handlers.get(event.kind, ()):
            handler(session, event)


event_bus = EventBus()


def emit_event(session: Session, kind: EventKind, entity_id: int | UUID | None = None, *,
               actor: str | None = None, worker_id: int | None = None, patient_id: int | None = None,
               version: int | None = None, old_role: str | None = None, new_role: str | None = None,
               revoked_count: int | None = None, reason: str | None = None) -> None:
    event_bus.publish(session, DomainEvent(
        kind=kind, actor=actor or current_actor.get() or "system:application", entity_id=entity_id,
        worker_id=worker_id, patient_id=patient_id, version=version, old_role=old_role, new_role=new_role,
        revoked_count=revoked_count, reason=reason,
    ))
