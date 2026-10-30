from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Administrator(Base):
    __tablename__ = 'administrator'
    __table_args__ = (CheckConstraint('id = 1', name='ck_single_administrator'),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    account_id: Mapped[UUID] = mapped_column(unique=True, default=uuid4)
    password_hash: Mapped[str] = mapped_column(String(512))
    totp_secret: Mapped[str] = mapped_column(String(64))
    last_totp_step: Mapped[int] = mapped_column(BigInteger)
    configured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    failed_attempts: Mapped[int] = mapped_column(default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdministratorSetup(Base):
    __tablename__ = 'administrator_setups'

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    totp_secret: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    failed_attempts: Mapped[int] = mapped_column(default=0)
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdministratorSession(Base):
    __tablename__ = 'administrator_sessions'

    id: Mapped[UUID] = mapped_column(unique=True, default=uuid4)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    administrator_id: Mapped[int] = mapped_column(ForeignKey('administrator.id', ondelete='CASCADE'))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
