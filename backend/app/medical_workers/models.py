from sqlalchemy import Boolean, CheckConstraint, String, false
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MedicalWorker(Base):
    __tablename__ = "medical_workers"
    __table_args__ = (
        CheckConstraint(
            "length(first_name) BETWEEN 3 AND 24",
            name="ck_medical_workers_first_name_length",
        ),
        CheckConstraint(
            "length(last_name) BETWEEN 3 AND 24",
            name="ck_medical_workers_last_name_length",
        ),
        CheckConstraint(
            "length(position) BETWEEN 3 AND 24",
            name="ck_medical_workers_position_length",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(24), nullable=False)
    last_name: Mapped[str] = mapped_column(String(24), nullable=False)
    position: Mapped[str] = mapped_column(String(24), nullable=False)
    is_deleted: Mapped[bool] = mapped_column(
        Boolean(create_constraint=True, name="ck_medical_workers_is_deleted"),
        default=False,
        server_default=false(),
        nullable=False,
    )
