from datetime import datetime, timezone

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.patients.models import Patient


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    patient: Mapped[Patient] = relationship(back_populates="medical_record")
    revisions: Mapped[list["MedicalRecordRevision"]] = relationship(
        back_populates="medical_record", passive_deletes="all"
    )


class MedicalRecordRevision(Base):
    __tablename__ = "medical_record_revisions"
    __table_args__ = (
        UniqueConstraint("medical_record_id", "version", name="uq_record_revision_version"),
        CheckConstraint("version > 0", name="ck_record_revision_version"),
        CheckConstraint("action IN ('created', 'saved')", name="ck_record_revision_action"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    medical_record_id: Mapped[int] = mapped_column(ForeignKey("medical_records.id", ondelete="RESTRICT"), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False)
    worker_id: Mapped[int] = mapped_column(ForeignKey("medical_workers.id", ondelete="RESTRICT"), nullable=False)
    editor: Mapped[dict] = mapped_column(JSON, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    action: Mapped[str] = mapped_column(String(7), nullable=False)
    diagnoses: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    prescriptions: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    medical_record: Mapped[MedicalRecord] = relationship(back_populates="revisions")
    changes: Mapped[list["MedicalRecordChange"]] = relationship(
        back_populates="revision", order_by="MedicalRecordChange.ordinal", passive_deletes="all"
    )
    prescription_links: Mapped["MedicalRecordPrescriptionLinks | None"] = relationship(
        back_populates="revision", passive_deletes="all"
    )


class MedicalRecordPrescriptionLinks(Base):
    __tablename__ = "medical_record_prescription_links"

    revision_id: Mapped[int] = mapped_column(ForeignKey("medical_record_revisions.id", ondelete="RESTRICT"), primary_key=True)
    sources: Mapped[list[int | None]] = mapped_column(JSON, nullable=False)
    revision: Mapped[MedicalRecordRevision] = relationship(back_populates="prescription_links")


class MedicalRecordChange(Base):
    __tablename__ = "medical_record_changes"
    __table_args__ = (
        UniqueConstraint("revision_id", "ordinal", name="uq_record_change_ordinal"),
        CheckConstraint("ordinal >= 0", name="ck_record_change_ordinal"),
        CheckConstraint(
            "kind IN ('record_created', 'record_saved', 'diagnosis_added', 'diagnosis_removed', "
            "'prescription_added', 'prescription_cancelled')", name="ck_record_change_kind"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("medical_record_revisions.id", ondelete="RESTRICT"), nullable=False)
    ordinal: Mapped[int] = mapped_column(nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    revision: Mapped[MedicalRecordRevision] = relationship(back_populates="changes")
