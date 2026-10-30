import hashlib
import secrets
import hmac
from uuid import UUID, uuid4
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.admin_auth.models import Administrator, AdministratorSession
from app.tokens import encode_token, decode_token, ADMIN_AUDIENCE


SESSION_COOKIE = 'psychosis_admin_session'
SETUP_COOKIE = 'psychosis_admin_setup'
SESSION_SECONDS = 8 * 60 * 60
ACCESS_SECONDS = 15 * 60
REFRESH_COOKIE = 'psychosis_admin_refresh'
SETUP_SECONDS = 10 * 60


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def set_cookie(response: Response, request: Request, name: str, value: str, max_age: int) -> None:
    response.set_cookie(name, value, max_age=max_age, httponly=True,
                        secure=request.url.scheme == 'https', samesite='strict', path='/api')


def revoke_session(session, token, kind='access'):
    try:
        claims = decode_token(session, token, kind, ADMIN_AUDIENCE)
    except HTTPException:
        return
    row = session.scalar(select(AdministratorSession).where(AdministratorSession.id == UUID(claims['jti'])).with_for_update())
    if row:
        row.revoked_at = utcnow()


def issue_session(session, administrator, request, response):
    token_id = uuid4()
    claims = {'sub': str(administrator.account_id), 'jti': str(token_id), 'ver': 0}
    access = encode_token(session, claims, 'access', ACCESS_SECONDS, ADMIN_AUDIENCE)
    refresh = encode_token(session, claims, 'refresh', SESSION_SECONDS, ADMIN_AUDIENCE)
    session.add(AdministratorSession(id=token_id, token_hash=token_hash(refresh), administrator_id=administrator.id,
                                    expires_at=utcnow() + timedelta(seconds=SESSION_SECONDS)))
    set_cookie(response, request, SESSION_COOKIE, access, ACCESS_SECONDS)
    set_cookie(response, request, REFRESH_COOKIE, refresh, SESSION_SECONDS)
    response.headers['Cache-Control'] = 'no-store'


def create_session(session: Session, request: Request, response: Response) -> None:
    session.execute(delete(AdministratorSession).where(AdministratorSession.expires_at <= utcnow()))
    revoke_session(session, request.cookies.get(SESSION_COOKIE))
    revoke_session(session, request.cookies.get(REFRESH_COOKIE), 'refresh')
    issue_session(session, session.get(Administrator, 1), request, response)


def rotate_session(session, request, response):
    raw = request.cookies.get(REFRESH_COOKIE)
    claims = decode_token(session, raw, 'refresh', ADMIN_AUDIENCE)
    administrator = session.scalar(select(Administrator).where(Administrator.id == 1).with_for_update())
    row = session.scalar(select(AdministratorSession).where(AdministratorSession.id == UUID(claims['jti'])).with_for_update())
    if (row is None or row.revoked_at is not None or row.expires_at <= utcnow()
            or administrator is None or str(administrator.account_id) != claims['sub']
            or row.administrator_id != administrator.id or not hmac.compare_digest(row.token_hash, token_hash(raw))):
        raise HTTPException(401, 'Сессия завершена. Войдите заново.')
    row.revoked_at = utcnow()
    issue_session(session, administrator, request, response)


def session_identity(engine, token: str | None):
    if not token:
        return None
    with Session(engine) as session:
        try:
            claims = decode_token(session, token, 'access', ADMIN_AUDIENCE)
        except HTTPException:
            return None
        return session.scalar(select(Administrator.account_id)
            .join(AdministratorSession, AdministratorSession.administrator_id == Administrator.id)
            .where(Administrator.account_id == UUID(claims['sub']), AdministratorSession.id == UUID(claims['jti']),
                   AdministratorSession.revoked_at.is_(None), AdministratorSession.expires_at > utcnow()))


def require_administrator(request: Request) -> None:
    if getattr(request.state, 'administrator_id', None) is None:
        raise HTTPException(401, 'Войдите как администратор с паролем и кодом TOTP')
