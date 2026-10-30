from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints
from app.medical_workers.types import MedicalWorkerRole


WorkerText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=3, max_length=24),
]


class MedicalWorkerWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]
    last_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]
    position: WorkerText
    role: MedicalWorkerRole = MedicalWorkerRole.OTHER


class MedicalWorkerRead(MedicalWorkerWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_deleted: bool
