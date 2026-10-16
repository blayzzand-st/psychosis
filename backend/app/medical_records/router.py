from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_session
from app.diagnoses.models import Diagnosis
from app.medical_records.models import MedicalRecord, MedicalRecordPrescriptionLinks, MedicalRecordRevision
from app.medical_records.history import describe_changes
from app.medical_records.schemas import MedicalRecordCreate, MedicalRecordHistoryEntry, MedicalRecordRead, MedicalRecordWrite
from app.medical_workers.models import MedicalWorker
from app.patients.models import Patient


router = APIRouter(prefix="/api/patients/{patient_id}/medical-record", tags=["ЭМК"])
DatabaseSession = Annotated[Session, Depends(get_session)]
PatientId = Annotated[int, Path(gt=0)]
VERSION_CONFLICT = "ЭМК изменена в другой вкладке. Обновите карту перед редактированием."


def require_patient(session: Session, patient_id: int) -> None:
    if session.get(Patient, patient_id) is None:
        raise HTTPException(status_code=404, detail="Пациент не найден")


def require_worker(session: Session, worker_id: int) -> MedicalWorker:
    worker = session.get(MedicalWorker, worker_id)
    if worker is None or worker.is_deleted:
        raise HTTPException(status_code=422, detail="Выберите действующего медработника.")
    return worker


def get_record(session: Session, patient_id: int) -> MedicalRecord:
    require_patient(session, patient_id)
    record = session.scalar(select(MedicalRecord).where(MedicalRecord.patient_id == patient_id))
    if record is None:
        raise HTTPException(status_code=404, detail="ЭМК ещё не создана")
    return record


def latest_revision(session: Session, record: MedicalRecord) -> MedicalRecordRevision | None:
    return session.scalar(
        select(MedicalRecordRevision).where(MedicalRecordRevision.medical_record_id == record.id)
        .order_by(MedicalRecordRevision.version.desc()).limit(1)
    )


def record_response(record: MedicalRecord, revision: MedicalRecordRevision | None) -> MedicalRecordRead:
    timestamp = revision.recorded_at if revision else None
    if timestamp is not None and timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return MedicalRecordRead(
        id=record.id, patient_id=record.patient_id, version=revision.version if revision else 0,
        diagnoses=revision.diagnoses if revision else [], prescriptions=revision.prescriptions if revision else [],
        edited_by=revision.editor if revision else None, updated_at=timestamp,
    )


def new_revision(record: MedicalRecord, worker: MedicalWorker, version: int, action: str,
                 diagnoses: list[dict], prescriptions: list[str], previous: MedicalRecordRevision | None = None,
                 prescription_sources: list[int | None] | None = None) -> MedicalRecordRevision:
    revision = MedicalRecordRevision(
        medical_record=record, version=version, worker_id=worker.id, action=action,
        editor={"id": worker.id, "first_name": worker.first_name, "last_name": worker.last_name, "position": worker.position},
        diagnoses=diagnoses, prescriptions=prescriptions,
    )
    revision.changes = describe_changes(previous, revision, prescription_sources)
    if prescription_sources is not None:
        revision.prescription_links = MedicalRecordPrescriptionLinks(sources=prescription_sources)
    return revision


@router.get("", response_model=MedicalRecordRead)
def read_medical_record(patient_id: PatientId, session: DatabaseSession,
                        at: Annotated[datetime | None, Query(description="Состояние ЭМК на момент ISO 8601 с часовым поясом")] = None) -> MedicalRecordRead:
    record = get_record(session, patient_id)
    if at is not None:
        if at.tzinfo is None or at.utcoffset() is None:
            raise HTTPException(status_code=422, detail="Укажите дату и время с часовым поясом.")
        revision = session.scalar(
            select(MedicalRecordRevision).where(
                MedicalRecordRevision.medical_record_id == record.id,
                MedicalRecordRevision.recorded_at <= at.astimezone(timezone.utc).replace(tzinfo=None),
            ).order_by(MedicalRecordRevision.version.desc()).limit(1)
        )
        if revision is None:
            raise HTTPException(status_code=404, detail="На указанный момент ЭМК ещё не существовала.")
        return record_response(record, revision)
    return record_response(record, latest_revision(session, record))


@router.get("/history", response_model=list[MedicalRecordHistoryEntry])
def read_medical_record_history(patient_id: PatientId, session: DatabaseSession) -> list[MedicalRecordHistoryEntry]:
    record = get_record(session, patient_id)
    revisions = session.scalars(
        select(MedicalRecordRevision).where(MedicalRecordRevision.medical_record_id == record.id)
        .options(selectinload(MedicalRecordRevision.changes), selectinload(MedicalRecordRevision.prescription_links))
        .order_by(MedicalRecordRevision.version)
    )
    return [MedicalRecordHistoryEntry(**record_response(record, revision).model_dump(), changes=revision.changes,
                                     prescription_sources=revision.prescription_links.sources if revision.prescription_links else None)
            for revision in revisions]


@router.post("", response_model=MedicalRecordRead, status_code=status.HTTP_201_CREATED)
def create_medical_record(patient_id: PatientId, payload: MedicalRecordCreate, session: DatabaseSession) -> MedicalRecordRead:
    require_patient(session, patient_id)
    worker = require_worker(session, payload.worker_id)
    record = MedicalRecord(patient_id=patient_id)
    revision = new_revision(record, worker, 1, "created", [], [])
    session.add_all([record, revision])
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="У пациента уже есть ЭМК.") from error
    session.refresh(revision)
    return record_response(record, revision)


@router.put("", response_model=MedicalRecordRead)
def save_medical_record(patient_id: PatientId, payload: MedicalRecordWrite, session: DatabaseSession) -> MedicalRecordRead:
    record = get_record(session, patient_id)
    worker = require_worker(session, payload.worker_id)
    previous = latest_revision(session, record)
    version = previous.version if previous else 0
    if payload.version != version:
        raise HTTPException(status_code=409, detail=VERSION_CONFLICT)

    if payload.prescription_sources is not None:
        sources = [source for source in payload.prescription_sources if source is not None]
        old_count = len(previous.prescriptions) if previous else 0
        if (len(payload.prescription_sources) != len(payload.prescriptions) or len(sources) != len(set(sources))
                or any(source >= old_count for source in sources)):
            raise HTTPException(status_code=422, detail="Некорректные ссылки на назначения предыдущей версии ЭМК.")

    old_diagnoses = {item["diagnosis_id"]: item for item in previous.diagnoses} if previous else {}
    diagnoses = []
    for diagnosis_id in payload.diagnosis_ids:
        if diagnosis_id in old_diagnoses:
            diagnoses.append(old_diagnoses[diagnosis_id])
            continue
        diagnosis = session.get(Diagnosis, diagnosis_id)
        if diagnosis is None:
            raise HTTPException(status_code=422, detail="Выбранный диагноз отсутствует в реестре. Обновите список диагнозов.")
        diagnoses.append({"diagnosis_id": diagnosis.id, "code": diagnosis.code, "name": diagnosis.name})

    revision = new_revision(record, worker, version + 1, "saved", diagnoses, payload.prescriptions, previous, payload.prescription_sources)
    session.add(revision)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail=VERSION_CONFLICT) from error
    session.refresh(revision)
    return record_response(record, revision)
