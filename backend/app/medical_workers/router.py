from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session
from app.events import EventKind, emit_event
from app.medical_workers.models import MedicalWorker
from app.medical_workers.schemas import MedicalWorkerRead, MedicalWorkerWrite
from app.accounts.service import worker_account, lock_worker
from app.user_auth.service import revoke_tokens


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
    session.flush()
    emit_event(session, EventKind.WORKER_CREATED, worker.id)
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
    worker = lock_worker(session, worker_id, require_active=False)
    if worker.is_deleted:
        raise HTTPException(status_code=404, detail="Медработник не найден")
    if "role" in payload.model_fields_set and worker.role != payload.role:
        account = worker_account(session, worker_id, required=False)
        if account is not None:
            revoke_tokens(session, account, 'role_changed')
        emit_event(session, EventKind.WORKER_ROLE_CHANGED, worker_id, old_role=worker.role, new_role=payload.role)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(worker, field, value)
    emit_event(session, EventKind.WORKER_UPDATED, worker_id)
    session.commit()
    session.refresh(worker)
    return worker


@router.delete("/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_worker(worker_id: WorkerId, session: DatabaseSession) -> Response:
    worker = lock_worker(session, worker_id, require_active=False)
    if worker.is_deleted:
        raise HTTPException(status_code=404, detail="Медработник не найден")
    worker.is_deleted = True
    emit_event(session, EventKind.WORKER_DELETED, worker_id)
    account = worker_account(session, worker_id, required=False)
    if account is not None and account.is_active:
        account.is_active = False
        revoke_tokens(session, account, 'deactivated')
        emit_event(session, EventKind.ACCOUNT_DEACTIVATED, account.id, worker_id=worker_id)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{worker_id}/restore", response_model=MedicalWorkerRead)
def restore_worker(worker_id: WorkerId, session: DatabaseSession) -> MedicalWorker:
    worker = lock_worker(session, worker_id, require_active=False)
    if worker.is_deleted:
        emit_event(session, EventKind.WORKER_RESTORED, worker_id)
    worker.is_deleted = False
    session.commit()
    session.refresh(worker)
    return worker
