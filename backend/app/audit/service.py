from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from app.audit.models import AuditEvent
from app.audit.schemas import AuditActor


_actor_adapter = TypeAdapter(AuditActor)


def append_audit_event(session: Session, *, actor: str, message: str) -> AuditEvent:
    """Append in the caller's transaction; never commit a business operation here.

    actor is account:<UUID>, anonymous:<request UUID>, or system:<component>.
    Callers must derive it from trusted server context, never from client payload.
    Messages must not contain passwords, tokens, or TOTP secrets.
    """
    actor = _actor_adapter.validate_python(actor)
    if not message.strip():
        raise ValueError("Audit message must not be empty")
    entry = AuditEvent(actor=actor, message=message)
    session.add(entry)
    return entry
