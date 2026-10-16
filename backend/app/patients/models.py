from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.patients.types import AdministrativeSex

if TYPE_CHECKING:
    from app.medical_records.models import MedicalRecord


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint("length(first_name) BETWEEN 1 AND 64", name="ck_patients_first_name_length"),
        CheckConstraint("length(last_name) BETWEEN 1 AND 64", name="ck_patients_last_name_length"),
        CheckConstraint("patronymic IS NULL OR length(patronymic) BETWEEN 1 AND 64", name="ck_patients_patronymic_length"),
        CheckConstraint("length(comment) <= 32", name="ck_patients_comment_length"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(64), nullable=False)
    last_name: Mapped[str] = mapped_column(String(64), nullable=False)
    patronymic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    administrative_sex: Mapped[AdministrativeSex] = mapped_column(
        Enum(
            AdministrativeSex,
            values_callable=lambda enum: [item.value for item in enum],
            native_enum=False,
            create_constraint=True,
            name="administrative_sex",
        ),
        nullable=False,
    )
    comment: Mapped[str] = mapped_column(String(32), nullable=False, default="", server_default="")
    medical_record: Mapped["MedicalRecord | None"] = relationship(
        back_populates="patient", passive_deletes="all"
    )

    @property
    def has_medical_record(self) -> bool:
        return self.medical_record is not None


