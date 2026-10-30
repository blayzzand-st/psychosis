import secrets
from datetime import timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.accounts.passwords import hash_password, verify_password
from app.admin_auth.models import Administrator, AdministratorSession, AdministratorSetup
from app.admin_auth.service import (SESSION_COOKIE, SETUP_COOKIE, SETUP_SECONDS, create_session,
                                    set_cookie, token_hash, utcnow, REFRESH_COOKIE, revoke_session, rotate_session, require_administrator)
from app.tokens import decode_token, ADMIN_AUDIENCE
from app.events import emit_event, EventKind
from uuid import UUID
from app.admin_auth.totp import generate_secret, verify_totp
from app.audit.service import record_login_event
from app.database import get_session


router = APIRouter(prefix='/api/admin-auth', tags=['Вход администратора'])
DatabaseSession = Annotated[Session, Depends(get_session)]


class SetupPassword(BaseModel):
    model_config = ConfigDict(extra='forbid')
    password: str = Field(min_length=1, max_length=128, repr=False)
    password_confirmation: str = Field(min_length=1, max_length=128, repr=False)

    @model_validator(mode='after')
    def confirm(self):
        if self.password != self.password_confirmation:
            raise ValueError('Пароли не совпадают')
        return self


class TotpCode(BaseModel):
    model_config = ConfigDict(extra='forbid')
    code: str = Field(min_length=1, max_length=32, repr=False)


class Login(TotpCode):
    password: str = Field(min_length=1, max_length=128, repr=False)


class DeleteAdministrator(Login):
    confirmation: Literal['УДАЛИТЬ']


def pending_setup(session: Session, request: Request, *, lock=False):
    token = request.cookies.get(SETUP_COOKIE, '')
    statement = select(AdministratorSetup).where(AdministratorSetup.token_hash == token_hash(token),
                                                AdministratorSetup.expires_at > utcnow())
    return session.scalar(statement.with_for_update() if lock else statement)


def reject_attempt(session: Session, target, *, audit=True):
    target.failed_attempts += 1
    if target.failed_attempts >= 5:
        target.blocked_until = utcnow() + timedelta(seconds=30)
        target.failed_attempts = 0
    if audit:
        record_login_event(session, administrator=True, success=False)
    session.commit()
    raise HTTPException(401, 'Неверный пароль или код TOTP. Используйте новый актуальный код.')


def check_throttle(target, session=None):
    if target.blocked_until and target.blocked_until > utcnow():
        if session is not None:
            record_login_event(session, administrator=True, success=False)
            session.commit()
        raise HTTPException(429, 'Слишком много попыток. Повторите через 30 секунд.', headers={'Retry-After': '30'})


@router.get('/status')
def auth_status(request: Request, response: Response, session: DatabaseSession):
    response.headers['Cache-Control'] = 'no-store'
    configured = session.get(Administrator, 1) is not None
    setup = pending_setup(session, request) if not configured else None
    return {'configured': configured, 'authenticated': request.state.administrator_id is not None,
            'setup_pending': setup is not None, 'totp_secret': setup.totp_secret if setup else None,
            'setup_expires_at': setup.expires_at if setup else None}


@router.post('/setup/start')
def start_setup(payload: SetupPassword, request: Request, response: Response, session: DatabaseSession):
    response.headers['Cache-Control'] = 'no-store'
    if session.get(Administrator, 1):
        raise HTTPException(409, 'Администратор уже настроен. Войдите с паролем и TOTP.')
    session.execute(delete(AdministratorSetup).where(AdministratorSetup.expires_at <= utcnow()))
    previous = pending_setup(session, request)
    if previous:
        session.delete(previous)
    token = secrets.token_urlsafe(32)
    setup = AdministratorSetup(token_hash=token_hash(token), password_hash=hash_password(payload.password),
                               totp_secret=generate_secret(), expires_at=utcnow() + timedelta(seconds=SETUP_SECONDS))
    session.add(setup)
    session.commit()
    set_cookie(response, request, SETUP_COOKIE, token, SETUP_SECONDS)
    return {'totp_secret': setup.totp_secret, 'setup_expires_at': setup.expires_at}


@router.post('/setup/complete')
def complete_setup(payload: TotpCode, request: Request, response: Response, session: DatabaseSession):
    # Serializes finalization even when different browsers start setup simultaneously.
    session.execute(text('SELECT pg_advisory_xact_lock(hashtext(current_schema()), 6238)'))
    if session.get(Administrator, 1):
        raise HTTPException(409, 'Администратор уже настроен. Войдите с паролем и TOTP.')
    setup = pending_setup(session, request, lock=True)
    if setup is None:
        raise HTTPException(410, 'Время настройки истекло. Задайте пароль заново.')
    check_throttle(setup)
    step = verify_totp(setup.totp_secret, payload.code)
    if step is None:
        reject_attempt(session, setup, audit=False)
    administrator = Administrator(password_hash=setup.password_hash, totp_secret=setup.totp_secret,
                                  last_totp_step=step, configured_at=utcnow())
    session.add(administrator)
    session.flush()
    create_session(session, request, response)
    record_login_event(session, administrator=True, success=True, account_id=administrator.account_id)
    session.execute(delete(AdministratorSetup))
    session.commit()
    response.delete_cookie(SETUP_COOKIE, path='/api')
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': True}


@router.post('/setup/cancel', status_code=204)
def cancel_setup(request: Request, session: DatabaseSession):
    token = request.cookies.get(SETUP_COOKIE, '')
    session.execute(delete(AdministratorSetup).where(AdministratorSetup.token_hash == token_hash(token)))
    session.commit()
    response = Response(status_code=204)
    response.delete_cookie(SETUP_COOKIE, path='/api')
    return response


@router.post('/login')
def login(payload: Login, request: Request, response: Response, session: DatabaseSession):
    administrator = session.scalar(select(Administrator).where(Administrator.id == 1).with_for_update())
    if administrator is None:
        record_login_event(session, administrator=True, success=False)
        session.commit()
        raise HTTPException(401, 'Сначала настройте администратора')
    check_throttle(administrator, session)
    valid_password = verify_password(payload.password, administrator.password_hash)
    step = verify_totp(administrator.totp_secret, payload.code, last_step=administrator.last_totp_step)
    if not valid_password or step is None:
        reject_attempt(session, administrator)
    administrator.last_totp_step = step
    administrator.failed_attempts = 0
    administrator.blocked_until = None
    create_session(session, request, response)
    record_login_event(session, administrator=True, success=True, account_id=administrator.account_id)
    session.commit()
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': True}


@router.post('/refresh')
def refresh_session(request: Request, response: Response, session: DatabaseSession):
    rotate_session(session, request, response)
    session.commit()
    return {'authenticated': True}


@router.post('/logout', status_code=204)
def logout(request: Request, session: DatabaseSession):
    revoke_session(session, request.cookies.get(SESSION_COOKIE))
    revoke_session(session, request.cookies.get(REFRESH_COOKIE), 'refresh')
    session.commit()
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path='/api')
    response.delete_cookie(REFRESH_COOKIE, path='/api')
    return response


@router.delete('/account', status_code=204, dependencies=[Depends(require_administrator)])
def delete_administrator(payload: DeleteAdministrator, request: Request, session: DatabaseSession):
    # Use the same lock as first-time setup: reset and setup cannot interleave.
    session.execute(text('SELECT pg_advisory_xact_lock(hashtext(current_schema()), 6238)'))
    administrator = session.scalar(select(Administrator).where(Administrator.id == 1).with_for_update())
    claims = decode_token(session, request.cookies.get(SESSION_COOKIE), 'access', ADMIN_AUDIENCE)
    current = session.scalar(select(AdministratorSession).where(
        AdministratorSession.id == UUID(claims['jti'])).with_for_update())
    if (administrator is None or str(administrator.account_id) != claims['sub']
            or current is None or current.revoked_at is not None or current.expires_at <= utcnow()
            or current.administrator_id != administrator.id):
        raise HTTPException(401, 'Войдите как администратор заново')
    check_throttle(administrator)
    valid = verify_password(payload.password, administrator.password_hash)
    step = verify_totp(administrator.totp_secret, payload.code, last_step=administrator.last_totp_step)
    if not valid or step is None:
        emit_event(session, EventKind.ADMIN_DELETE_FAILED, administrator.account_id)
        reject_attempt(session, administrator, audit=False)
    emit_event(session, EventKind.ADMIN_DELETED, administrator.account_id)
    session.execute(delete(AdministratorSession))
    session.execute(delete(AdministratorSetup))
    session.delete(administrator)
    session.commit()
    response = Response(status_code=204, headers={'Cache-Control': 'no-store'})
    for name in (SESSION_COOKIE, REFRESH_COOKIE, SETUP_COOKIE):
        response.delete_cookie(name, path='/api')
    return response
