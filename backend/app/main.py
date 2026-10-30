from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import asyncio
from uuid import uuid4

from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse
from sqlalchemy import Engine

from app.database import Base, engine
from app.admin_auth.router import router as admin_auth_router
from app.admin_auth.service import SESSION_COOKIE, require_administrator, session_identity
from app.accounts.models import UserAccount  # Register the account table in metadata.
from app.accounts.router import router as accounts_router
from app.accounts.router import worker_accounts_router
from app.schema import initialize_database
from app.audit.models import AuditEvent  # Register the audit table in metadata.
from app.audit.router import router as audit_router
from app.audit.service import current_actor, record_login_event
from sqlalchemy.orm import Session
from app.diagnoses.router import router as diagnoses_router
from app.medical_workers.router import router as medical_workers_router
from app.medical_records.router import router as medical_records_router
from app.medical_records.history import backfill_history
from app.patients.router import router as patients_router
from app.user_auth.router import router as user_auth_router
from app.user_auth.service import ACCESS_COOKIE, access_identity, require_worker, require_administrator_or_worker


def create_app(database_engine: Engine = engine) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        initialize_database(database_engine)
        backfill_history(database_engine)
        yield

    application = FastAPI(title="PsychosIS API", lifespan=lifespan)
    application.state.database_engine = database_engine
    administrator_access = [Depends(require_administrator)]
    application.include_router(admin_auth_router)
    application.include_router(user_auth_router)
    application.include_router(audit_router, dependencies=administrator_access)

    @application.middleware("http")
    async def identify_audit_actor(request, call_next):
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            origin = request.headers.get('origin')
            expected_origin = f'{request.url.scheme}://{request.headers.get("host", "")}'
            if ((origin and origin.rstrip('/') != expected_origin)
                    or request.headers.get('sec-fetch-site') == 'cross-site'):
                return JSONResponse({'detail': 'Запрос с другого сайта запрещён'}, status_code=403)
        account_id = await asyncio.to_thread(session_identity, database_engine, request.cookies.get(SESSION_COOKIE))
        request.state.administrator_id = account_id
        access_token = request.cookies.get(ACCESS_COOKIE)
        authorization = request.headers.get('authorization')
        if authorization is not None:
            access_token = authorization[7:] if authorization.lower().startswith('bearer ') else None
        user = await asyncio.to_thread(access_identity, database_engine, access_token)
        request.state.medical_worker = user
        actor_id = user['account_id'] if user and request.url.path.startswith(('/api/patients', '/api/user-auth')) else account_id
        actor = f"account:{actor_id}" if actor_id else f"anonymous:{uuid4()}"
        request.state.audit_actor = actor
        token = current_actor.set(actor)
        try:
            return await call_next(request)
        finally:
            current_actor.reset(token)
    @application.exception_handler(RequestValidationError)
    async def invalid_auth_request(request, exception):
        if request.url.path.startswith(('/api/admin-auth/', '/api/user-auth/')):
            if request.url.path in ('/api/admin-auth/login', '/api/user-auth/login'):
                def log_failure():
                    with Session(database_engine) as session:
                        record_login_event(session, administrator=request.url.path == '/api/admin-auth/login', success=False)
                        session.commit()
                await asyncio.to_thread(log_failure)
            # Never echo submitted passwords or TOTP codes in validation responses.
            detail = ('Проверьте логин и пароль' if request.url.path.startswith('/api/user-auth/') else
                      'Проверьте поля: пароль не должен быть пустым или длиннее 128 символов, подтверждение должно совпадать; код TOTP — 6 цифр.')
            return JSONResponse({'detail': detail}, status_code=422)
        return await request_validation_exception_handler(request, exception)

    application.include_router(accounts_router, dependencies=administrator_access)
    application.include_router(worker_accounts_router, dependencies=administrator_access)
    application.include_router(medical_workers_router, dependencies=administrator_access)
    application.include_router(diagnoses_router, dependencies=[Depends(require_administrator_or_worker)])
    application.include_router(patients_router, dependencies=[Depends(require_worker)])
    application.include_router(medical_records_router, dependencies=[Depends(require_worker)])

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
