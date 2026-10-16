from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_session
from app.diagnoses.models import Diagnosis
from app.diagnoses.schemas import DiagnosisRead, DiagnosisWrite


router = APIRouter(prefix="/api/diagnoses", tags=["Диагнозы"])
DatabaseSession = Annotated[Session, Depends(get_session)]
DiagnosisId = Annotated[int, Path(gt=0)]


def get_diagnosis(session: Session, diagnosis_id: int) -> Diagnosis:
    diagnosis = session.get(Diagnosis, diagnosis_id)
    if diagnosis is None:
        raise HTTPException(status_code=404, detail="Диагноз не найден")
    return diagnosis


def save_diagnosis(session: Session, diagnosis: Diagnosis) -> Diagnosis:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Диагноз с таким кодом или наименованием уже существует.",
        ) from error
    session.refresh(diagnosis)
    return diagnosis


@router.get("", response_model=list[DiagnosisRead])
def list_diagnoses(session: DatabaseSession) -> list[Diagnosis]:
    return list(session.scalars(select(Diagnosis).order_by(Diagnosis.id)))


@router.post("", response_model=DiagnosisRead, status_code=status.HTTP_201_CREATED)
def create_diagnosis(payload: DiagnosisWrite, session: DatabaseSession) -> Diagnosis:
    diagnosis = Diagnosis(**payload.model_dump())
    session.add(diagnosis)
    return save_diagnosis(session, diagnosis)


@router.get("/{diagnosis_id}", response_model=DiagnosisRead)
def read_diagnosis(diagnosis_id: DiagnosisId, session: DatabaseSession) -> Diagnosis:
    return get_diagnosis(session, diagnosis_id)


@router.put("/{diagnosis_id}", response_model=DiagnosisRead)
def update_diagnosis(diagnosis_id: DiagnosisId, payload: DiagnosisWrite, session: DatabaseSession) -> Diagnosis:
    diagnosis = get_diagnosis(session, diagnosis_id)
    diagnosis.code = payload.code
    diagnosis.name = payload.name
    return save_diagnosis(session, diagnosis)


@router.delete("/{diagnosis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagnosis(diagnosis_id: DiagnosisId, session: DatabaseSession) -> Response:
    diagnosis = get_diagnosis(session, diagnosis_id)
    session.delete(diagnosis)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
