from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthenticationKey(Base):
    __tablename__ = 'authentication_keys'
    __table_args__ = (CheckConstraint('id = 1', name='ck_single_authentication_key'),)
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    secret: Mapped[str] = mapped_column(String(128))  # Retained only for legacy schema compatibility.
    private_key: Mapped[str | None] = mapped_column(Text)
    public_key: Mapped[str | None] = mapped_column(Text)


class UserRefreshToken(Base):
    __tablename__ = 'user_refresh_tokens'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(default=uuid4, index=True)
    account_id: Mapped[UUID] = mapped_column(ForeignKey('user_accounts.id', ondelete='CASCADE'), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(String(64))
