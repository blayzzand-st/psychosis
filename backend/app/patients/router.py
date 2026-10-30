from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_session
from app.events import EventKind, emit_event
from app.patients.models import Patient
from app.patients.schemas import PatientRead, PatientWrite
from app.user_auth.service import require_creator


router = APIRouter(prefix="/api/patients", tags=["Пациенты"])
DatabaseSession = Annotated[Session, Depends(get_session)]
PatientId = Annotated[int, Path(gt=0)]
DELETE_BLOCKED = "Нельзя удалить пациента, для которого создана ЭМК."


def get_patient(session: Session, patient_id: int) -> Patient:
    patient = session.get(Patient, patient_id, options=[selectinload(Patient.medical_record)])
    if patient is None:
        raise HTTPException(status_code=404, detail="Пациент не найден")
    return patient


@router.get("", response_model=list[PatientRead])
def list_patients(session: DatabaseSession) -> list[Patient]:
    query = select(Patient).options(selectinload(Patient.medical_record)).order_by(Patient.id)
    return list(session.scalars(query))


@router.post("", response_model=PatientRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_creator)])
def create_patient(payload: PatientWrite, session: DatabaseSession) -> Patient:
    patient = Patient(**payload.model_dump())
    session.add(patient)
    session.flush()
    emit_event(session, EventKind.PATIENT_CREATED, patient.id)
    session.commit()
    session.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientRead)
def read_patient(patient_id: PatientId, session: DatabaseSession) -> Patient:
    return get_patient(session, patient_id)


@router.put("/{patient_id}", response_model=PatientRead)
def update_patient(patient_id: PatientId, payload: PatientWrite, session: DatabaseSession) -> Patient:
    patient = get_patient(session, patient_id)
    for field, value in payload.model_dump().items():
        setattr(patient, field, value)
    emit_event(session, EventKind.PATIENT_UPDATED, patient.id)
    session.commit()
    session.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: PatientId, session: DatabaseSession) -> Response:
    patient = get_patient(session, patient_id)
    if patient.has_medical_record:
        raise HTTPException(status_code=409, detail=DELETE_BLOCKED)
    session.delete(patient)
    emit_event(session, EventKind.PATIENT_DELETED, patient_id)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail=DELETE_BLOCKED) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
