from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from app.accounts.models import UserAccount
from app.accounts.schemas import UserAccountListItem, UserAccountRead, UserAccountCreate, UserAccountCredentials, UserAccountStatusWrite
from app.accounts.passwords import generate_password, hash_password
from app.accounts.service import lock_worker, worker_account
from app.events import EventKind, emit_event
from app.database import get_session
from app.user_auth.service import revoke_tokens


router = APIRouter(prefix="/api/accounts", tags=["Аккаунты"])
worker_accounts_router = APIRouter(prefix="/api/medical-workers/{worker_id}/account", tags=["Аккаунты"])
DatabaseSession = Annotated[Session, Depends(get_session)]
WorkerId = Annotated[int, Path(gt=0)]


@worker_accounts_router.get("", response_model=UserAccountRead | None)
def read_worker_account(worker_id: WorkerId, session: DatabaseSession, response: Response) -> UserAccount | None:
    response.headers["Cache-Control"] = "no-store"
    lock_worker(session, worker_id, require_active=False)
    return worker_account(session, worker_id, required=False)


@worker_accounts_router.post("", response_model=UserAccountCredentials, status_code=201)
def create_worker_account(worker_id: WorkerId, payload: UserAccountCreate, session: DatabaseSession,
                          response: Response) -> UserAccountCredentials:
    response.headers["Cache-Control"] = "no-store"
    lock_worker(session, worker_id)
    if worker_account(session, worker_id, required=False) is not None:
        raise HTTPException(status_code=409, detail="У медработника уже есть аккаунт")
    password = generate_password()
    account = UserAccount(username=payload.username, password_hash=hash_password(password), medical_worker_id=worker_id)
    session.add(account)
    try:
        session.flush()
        emit_event(session, EventKind.ACCOUNT_CREATED, account.id, worker_id=worker_id)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Логин уже занят или у медработника уже есть аккаунт")
    return UserAccountCredentials(account=UserAccountRead.model_validate(account), password=password)


@worker_accounts_router.post("/reset-password", response_model=UserAccountCredentials)
def reset_worker_password(worker_id: WorkerId, session: DatabaseSession, response: Response) -> UserAccountCredentials:
    response.headers["Cache-Control"] = "no-store"
    lock_worker(session, worker_id)
    account = worker_account(session, worker_id)
    password = generate_password()
    account.password_hash = hash_password(password)
    revoke_tokens(session, account, 'password_changed')
    emit_event(session, EventKind.ACCOUNT_PASSWORD_RESET, account.id)
    session.commit()
    return UserAccountCredentials(account=UserAccountRead.model_validate(account), password=password)


@worker_accounts_router.patch("", response_model=UserAccountRead)
def change_worker_account_status(worker_id: WorkerId, payload: UserAccountStatusWrite,
                                 session: DatabaseSession, response: Response) -> UserAccount:
    response.headers["Cache-Control"] = "no-store"
    lock_worker(session, worker_id)
    account = worker_account(session, worker_id)
    if account.is_active != payload.is_active:
        account.is_active = payload.is_active
        if not account.is_active:
            revoke_tokens(session, account, 'deactivated')
        emit_event(session, EventKind.ACCOUNT_ACTIVATED if account.is_active else EventKind.ACCOUNT_DEACTIVATED, account.id)
    session.commit()
    return account


@router.get("", response_model=list[UserAccountListItem])
def list_accounts(session: Annotated[Session, Depends(get_session)]) -> list[UserAccount]:
    statement = (
        select(UserAccount)
        .options(selectinload(UserAccount.medical_worker))
        .order_by(UserAccount.username, UserAccount.id)
    )
    return list(session.scalars(statement))


def lock_account(session: Session, account_id: UUID) -> UserAccount:
    account = session.get(UserAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Аккаунт не найден")
    # Keep the same lock order as worker-based operations.
    if account.medical_worker_id is not None:
        lock_worker(session, account.medical_worker_id, require_active=False)
    account = session.scalar(select(UserAccount).where(UserAccount.id == account_id)
                             .with_for_update().execution_options(populate_existing=True))
    if account is None:
        raise HTTPException(status_code=404, detail="Аккаунт не найден")
    return account


@router.patch("/{account_id}", response_model=UserAccountRead)
def change_account_status(account_id: UUID, payload: UserAccountStatusWrite,
                          session: DatabaseSession, response: Response) -> UserAccount:
    response.headers["Cache-Control"] = "no-store"
    account = lock_account(session, account_id)
    if payload.is_active and account.medical_worker_id is not None:
        lock_worker(session, account.medical_worker_id)
    if account.is_active != payload.is_active:
        account.is_active = payload.is_active
        if not account.is_active:
            revoke_tokens(session, account, 'deactivated')
        emit_event(session, EventKind.ACCOUNT_ACTIVATED if account.is_active else EventKind.ACCOUNT_DEACTIVATED, account.id)
    session.commit()
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: UUID, session: DatabaseSession) -> Response:
    account = lock_account(session, account_id)
    revoke_tokens(session, account, 'deleted')
    emit_event(session, EventKind.ACCOUNT_DELETED, account.id)
    session.delete(account)
    session.commit()
    return Response(status_code=204)
