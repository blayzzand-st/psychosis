from datetime import datetime
from typing import Annotated
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


EntityId = Annotated[int, Field(gt=0, strict=True)]
PrescriptionText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=128)]


class MedicalRecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    worker_id: EntityId


class MedicalRecordWrite(MedicalRecordCreate):
    version: Annotated[int, Field(ge=0, strict=True)]
    diagnosis_ids: list[EntityId]
    prescriptions: list[PrescriptionText]
    prescription_sources: list[Annotated[int, Field(ge=0, strict=True)] | None] | None = None

    @field_validator("diagnosis_ids")
    @classmethod
    def reject_duplicate_diagnoses(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("Диагноз не должен повторяться в ЭМК")
        return value


class DiagnosisSnapshot(BaseModel):
    diagnosis_id: int
    code: str
    name: str


class EditorSnapshot(BaseModel):
    id: int
    first_name: str
    last_name: str
    position: str


class MedicalRecordRead(BaseModel):
    id: int
    patient_id: int
    version: int
    diagnoses: list[DiagnosisSnapshot]
    prescriptions: list[str]
    edited_by: EditorSnapshot | None
    updated_at: datetime | None


class MedicalRecordChangeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    kind: Literal["record_created", "record_saved", "diagnosis_added", "diagnosis_removed", "prescription_added", "prescription_cancelled"]
    data: dict


class MedicalRecordHistoryEntry(MedicalRecordRead):
    changes: list[MedicalRecordChangeRead]
    prescription_sources: list[int | None] | None
