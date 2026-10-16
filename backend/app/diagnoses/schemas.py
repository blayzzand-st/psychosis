from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator


class DiagnosisWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Annotated[str, StringConstraints(min_length=6, max_length=6)]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=128)]

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value


class DiagnosisRead(DiagnosisWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
