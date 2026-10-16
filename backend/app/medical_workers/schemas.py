from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


WorkerText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=3, max_length=24),
]


class MedicalWorkerWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: WorkerText
    last_name: WorkerText
    position: WorkerText


class MedicalWorkerRead(MedicalWorkerWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_deleted: bool
