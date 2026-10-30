from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Uuid, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.medical_workers.models import MedicalWorker


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserAccount(Base):
    __tablename__ = "user_accounts"
    __table_args__ = (
        CheckConstraint("length(username) BETWEEN 3 AND 16", name="ck_accounts_username_length"),
        CheckConstraint("length(password_hash) > 0", name="ck_accounts_password_hash_not_empty"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true(), nullable=False)
    auth_version: Mapped[int] = mapped_column(default=0, server_default='0')
    failed_attempts: Mapped[int] = mapped_column(default=0, server_default='0')
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    medical_worker_id: Mapped[int | None] = mapped_column(
        ForeignKey("medical_workers.id", ondelete="RESTRICT"), unique=True, nullable=True,
    )
    medical_worker: Mapped[MedicalWorker | None] = relationship()
