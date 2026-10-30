
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.medical_workers.models import MedicalWorker


def lock_worker(session: Session, worker_id: int, *, require_active: bool = True) -> MedicalWorker:
    worker = session.scalar(select(MedicalWorker).where(MedicalWorker.id == worker_id).with_for_update())
    if worker is None:
        raise HTTPException(status_code=404, detail="Медработник не найден")
    if require_active and worker.is_deleted:
        raise HTTPException(status_code=409, detail="Сначала восстановите медработника")
    return worker


def worker_account(session: Session, worker_id: int, *, required: bool = True) -> UserAccount | None:
    account = session.scalar(select(UserAccount).where(UserAccount.medical_worker_id == worker_id))
    if account is None and required:
        raise HTTPException(status_code=404, detail="Аккаунт ещё не создан")
    return account
