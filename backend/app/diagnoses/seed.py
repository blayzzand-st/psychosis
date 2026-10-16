"""Explicitly load five examples from WHO ICD-11 MMS, release 2026-01."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.diagnoses.models import Diagnosis


EXAMPLES = (
    ("4A40.0", "Системная красная волчанка"),
    ("CA23.0", "Аллергическая астма"),
    ("CA40.0", "Бактериальная пневмония"),
    ("8A80.0", "Мигрень без ауры"),
    ("DB10.0", "Острый аппендицит"),
)


def seed_diagnoses(session: Session) -> int:
    added = 0
    for code, name in EXAMPLES:
        if session.scalar(select(Diagnosis).where(Diagnosis.code == code)) is None:
            session.add(Diagnosis(code=code, name=name))
            added += 1
    session.commit()
    return added


if __name__ == "__main__":
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        print(f"Добавлено диагнозов: {seed_diagnoses(session)}")
