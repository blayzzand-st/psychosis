import re
from datetime import date
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app.patients.types import AdministrativeSex


PatientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class PatientWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: PatientName
    last_name: PatientName
    patronymic: PatientName | None = None
    date_of_birth: date
    administrative_sex: AdministrativeSex
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=32)] = ""

    @field_validator("patronymic", mode="before")
    @classmethod
    def empty_patronymic_is_absent(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def require_calendar_date(cls, value: object) -> object:
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Укажите дату в формате ГГГГ-ММ-ДД")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def reject_future_birth(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Дата рождения не может быть в будущем")
        return value


class PatientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    patronymic: str | None
    date_of_birth: date
    administrative_sex: AdministrativeSex
    comment: str
    has_medical_record: bool
