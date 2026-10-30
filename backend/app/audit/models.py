from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text, Uuid, event
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        CheckConstraint("length(actor) BETWEEN 1 AND 128", name="ck_audit_actor_length"),
        CheckConstraint("length(trim(message)) > 0", name="ck_audit_message_not_empty"),
        Index("ix_audit_chronology", "event_time", "event_id"),
    )

    event_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False,
    )
    # A stable namespaced identifier, independent of mutable names and logins.
    # No cascading FK: history must survive deletion of its original actor.
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    actor_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    display_message: Mapped[str | None] = mapped_column(Text, nullable=True)


@event.listens_for(AuditEvent, "before_update")
@event.listens_for(AuditEvent, "before_delete")
def prevent_audit_modification(_mapper, _connection, _target) -> None:
    raise ValueError("Audit events cannot be changed or deleted")
