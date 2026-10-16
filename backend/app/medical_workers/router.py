from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session
from app.medical_workers.models import MedicalWorker
from app.medical_workers.schemas import MedicalWorkerRead, MedicalWorkerWrite


router = APIRouter(prefix="/api/medical-workers", tags=["Медработники"])
DatabaseSession = Annotated[Session, Depends(get_session)]
WorkerId = Annotated[int, Path(gt=0)]


def get_worker(session: Session, worker_id: int, include_deleted: bool = False) -> MedicalWorker:
    worker = session.get(MedicalWorker, worker_id)
    if worker is None or (worker.is_deleted and not include_deleted):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Медработник не найден",
        )
    return worker


@router.post("", response_model=MedicalWorkerRead, status_code=status.HTTP_201_CREATED)
def create_worker(payload: MedicalWorkerWrite, session: DatabaseSession) -> MedicalWorker:
    worker = MedicalWorker(**payload.model_dump())
    session.add(worker)
    session.commit()
    session.refresh(worker)
    return worker


@router.get("", response_model=list[MedicalWorkerRead])
def list_workers(
    session: DatabaseSession,
    include_deleted: bool = False,
) -> list[MedicalWorker]:
    statement = select(MedicalWorker).order_by(MedicalWorker.id)
    if not include_deleted:
        statement = statement.where(MedicalWorker.is_deleted.is_(False))
    return list(session.scalars(statement))


@router.get("/{worker_id}", response_model=MedicalWorkerRead)
def read_worker(
    worker_id: WorkerId,
    session: DatabaseSession,
    include_deleted: bool = False,
) -> MedicalWorker:
    return get_worker(session, worker_id, include_deleted=include_deleted)


@router.put("/{worker_id}", response_model=MedicalWorkerRead)
def update_worker(
    worker_id: WorkerId,
    payload: MedicalWorkerWrite,
    session: DatabaseSession,
) -> MedicalWorker:
    worker = get_worker(session, worker_id)
    for field, value in payload.model_dump().items():
        setattr(worker, field, value)
    session.commit()
    session.refresh(worker)
    return worker


@router.delete("/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_worker(worker_id: WorkerId, session: DatabaseSession) -> Response:
    worker = get_worker(session, worker_id)
    worker.is_deleted = True
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{worker_id}/restore", response_model=MedicalWorkerRead)
def restore_worker(worker_id: WorkerId, session: DatabaseSession) -> MedicalWorker:
    worker = get_worker(session, worker_id, include_deleted=True)
    worker.is_deleted = False
    session.commit()
    session.refresh(worker)
    return worker
