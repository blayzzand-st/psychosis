from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.accounts.models import UserAccount
from app.admin_auth.service import set_cookie, token_hash, utcnow
from app.database import get_session
from app.medical_workers.models import MedicalWorker
from app.user_auth.models import AuthenticationKey, UserRefreshToken


ACCESS_COOKIE = 'psychosis_user_access'
REFRESH_COOKIE = 'psychosis_user_refresh'
ACCESS_SECONDS = 15 * 60
REFRESH_SECONDS = 7 * 24 * 60 * 60
ISSUER, AUDIENCE = 'PsychosIS', 'PsychosIS-medical-worker'


from app.tokens import encode_token, decode_token


def lock_account(session, account_id):
    worker_id = session.scalar(select(UserAccount.medical_worker_id).where(UserAccount.id == account_id))
    if worker_id is None:
        raise HTTPException(401, 'Аккаунт недоступен')
    worker = session.scalar(select(MedicalWorker).where(MedicalWorker.id == worker_id).with_for_update())
    account = session.scalar(select(UserAccount).where(UserAccount.id == account_id)
        .with_for_update().execution_options(populate_existing=True))
    if account is None or not account.is_active or worker is None or worker.is_deleted:
        raise HTTPException(401, 'Аккаунт недоступен')
    return account, worker


def issue_tokens(session, account, worker, request, response, *, family_id=None):
    token_id = uuid4()
    family_id = family_id or token_id
    base = {'sub': str(account.id), 'jti': str(token_id), 'ver': account.auth_version,
            'worker_id': worker.id, 'role': worker.role, 'sid': str(family_id)}
    refresh = encode_token(session, base, 'refresh', REFRESH_SECONDS)
    access = encode_token(session, base, 'access', ACCESS_SECONDS)
    session.add(UserRefreshToken(id=token_id, family_id=family_id, account_id=account.id, token_hash=token_hash(refresh),
                                expires_at=utcnow() + timedelta(seconds=REFRESH_SECONDS)))
    set_cookie(response, request, ACCESS_COOKIE, access, ACCESS_SECONDS)
    set_cookie(response, request, REFRESH_COOKIE, refresh, REFRESH_SECONDS)
    response.headers['Cache-Control'] = 'no-store'
    return {'authenticated': True, 'user': user_info(account, worker)}


def user_info(account, worker):
    return {'account_id': str(account.id), 'username': account.username, 'worker_id': worker.id,
            'first_name': worker.first_name, 'last_name': worker.last_name, 'role': worker.role,
            'can_create': worker.role in ('doctor', 'nurse'), 'can_edit_record': worker.role == 'doctor'}


def access_identity(engine, token):
    if not token:
        return None
    with Session(engine) as session:
        try:
            claims = decode_token(session, token, 'access')
            account = session.get(UserAccount, UUID(claims['sub']))
            worker = session.get(MedicalWorker, account.medical_worker_id) if account and account.medical_worker_id else None
            refresh = session.get(UserRefreshToken, UUID(claims['jti']))
            if (account is None or worker is None or not account.is_active or worker.is_deleted
                    or account.auth_version != claims['ver'] or worker.id != claims.get('worker_id')
                    or worker.role != claims.get('role') or refresh is None or refresh.account_id != account.id
                    or str(refresh.family_id) != claims.get('sid', claims['jti'])
                    or refresh.revoked_at is not None or refresh.expires_at <= utcnow()):
                return None
            return {**user_info(account, worker), 'auth_version': account.auth_version,
                    'session_id': claims['jti'], 'session_family_id': str(refresh.family_id)}
        except HTTPException:
            return None


def require_worker(request: Request, session: Session = Depends(get_session)):
    principal = getattr(request.state, 'medical_worker', None)
    if principal is None:
        raise HTTPException(401, 'Войдите в аккаунт медработника')
    account, worker = lock_account(session, UUID(principal['account_id']))
    if account.auth_version != principal['auth_version']:
        raise HTTPException(401, 'Права доступа изменились. Войдите заново.')
    refresh = session.get(UserRefreshToken, UUID(principal['session_id']))
    if refresh is None or refresh.revoked_at is not None or refresh.expires_at <= utcnow():
        raise HTTPException(401, 'Сессия завершена. Войдите заново.')
    return worker


def require_creator(worker: MedicalWorker = Depends(require_worker)):
    if worker.role not in ('doctor', 'nurse'):
        raise HTTPException(403, 'Создание доступно только врачу или медсестре')
    return worker


def require_doctor(worker: MedicalWorker = Depends(require_worker)):
    if worker.role != 'doctor':
        raise HTTPException(403, 'Разблокировка и редактирование ЭМК доступны только врачу')
    return worker


def require_administrator_or_worker(request: Request):
    if request.state.administrator_id is None and request.state.medical_worker is None:
        raise HTTPException(401, 'Требуется вход в систему')
    if request.method not in ('GET', 'HEAD') and request.state.administrator_id is None:
        raise HTTPException(403, 'Управление справочниками доступно только администратору')


def revoke_tokens(session, account, reason):
    now = utcnow()
    ids = list(session.scalars(update(UserRefreshToken).where(
        UserRefreshToken.account_id == account.id, UserRefreshToken.revoked_at.is_(None),
        UserRefreshToken.expires_at > now,
    ).values(revoked_at=now, revoked_reason=reason).returning(UserRefreshToken.id)))
    account.auth_version += 1
    # Import after model registration to avoid coupling the event module to authentication.
    from app.events import emit_event, EventKind
    emit_event(session, EventKind.REFRESH_TOKENS_REVOKED, account.id, revoked_count=len(ids), reason=reason)
    return len(ids)
