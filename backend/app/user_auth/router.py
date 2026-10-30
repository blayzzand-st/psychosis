import hmac
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.accounts.passwords import hash_password, verify_password
from app.admin_auth.service import token_hash, utcnow
from app.audit.service import record_login_event
from app.database import get_session
from app.user_auth.models import UserRefreshToken
from app.user_auth.service import (ACCESS_COOKIE, REFRESH_COOKIE, decode_token, issue_tokens, lock_account)


router = APIRouter(prefix='/api/user-auth', tags=['Вход медработника'])
_dummy_hash = hash_password('dummy-password-never-used-for-login')


class Login(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=128, repr=False)


@router.get('/status')
def status(request: Request, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    user = request.state.medical_worker
    return {'authenticated': user is not None, 'user': user}


@router.post('/login')
def login(payload: Login, request: Request, response: Response, session: Session = Depends(get_session)):
    account = session.scalar(select(UserAccount).where(UserAccount.username == payload.username))
    worker = None
    if account is not None:
        try:
            account, worker = lock_account(session, account.id)
        except HTTPException:
            pass
    if account is not None and account.blocked_until and account.blocked_until > utcnow():
        record_login_event(session, administrator=False, success=False)
        session.commit()
        raise HTTPException(429, 'Слишком много попыток. Повторите через 30 секунд.', headers={'Retry-After': '30'})
    valid = verify_password(payload.password, account.password_hash if account else _dummy_hash)
    if account is None or worker is None or not valid:
        if account is not None:
            account.failed_attempts += 1
            if account.failed_attempts >= 5:
                account.failed_attempts = 0
                account.blocked_until = utcnow() + timedelta(seconds=30)
        record_login_event(session, administrator=False, success=False)
        session.commit()
        raise HTTPException(401, 'Неверный логин или пароль либо аккаунт недоступен')
    account.failed_attempts = 0
    account.blocked_until = None
    result = issue_tokens(session, account, worker, request, response)
    record_login_event(session, administrator=False, success=True, account_id=account.id)
    session.commit()
    return result


@router.post('/refresh')
def refresh(request: Request, response: Response, session: Session = Depends(get_session)):
    raw = request.cookies.get(REFRESH_COOKIE)
    claims = decode_token(session, raw, 'refresh')
    account, worker = lock_account(session, UUID(claims['sub']))
    token = session.scalar(select(UserRefreshToken).where(UserRefreshToken.id == UUID(claims['jti'])).with_for_update())
    if (token is None or token.account_id != account.id or token.revoked_at is not None or token.expires_at <= utcnow()
            or account.auth_version != claims['ver'] or not hmac.compare_digest(token.token_hash, token_hash(raw))):
        raise HTTPException(401, 'Сессия завершена. Войдите заново.')
    token.revoked_at, token.revoked_reason = utcnow(), 'rotation'
    result = issue_tokens(session, account, worker, request, response, family_id=token.family_id)
    session.commit()
    return result


@router.post('/logout', status_code=204)
def logout(request: Request, session: Session = Depends(get_session)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        try:
            claims = decode_token(session, raw, 'refresh')
            token = session.get(UserRefreshToken, UUID(claims['jti']))
            if token and token.account_id == UUID(claims['sub']) and hmac.compare_digest(token.token_hash, token_hash(raw)):
                token.revoked_at, token.revoked_reason = utcnow(), 'logout'
                session.commit()
        except HTTPException:
            pass
    response = Response(status_code=204)
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path='/api')
    return response
