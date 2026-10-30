from typing import Annotated
import asyncio

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit.queries import AUDIT_SELECT
from app.audit.presentation import present_events, session_names
from app.audit.schemas import AuditEventRead
from app.database import get_session
from app.audit.stream import audit_stream
from app.admin_auth.service import SESSION_COOKIE, session_identity


router = APIRouter(prefix="/api/audit", tags=["Аудит"])


@router.get("/stream")
async def stream_audit_events(request: Request) -> StreamingResponse:
    token = request.cookies.get(SESSION_COOKIE)
    async def authorized():
        return await asyncio.to_thread(session_identity, request.app.state.database_engine, token) is not None
    return StreamingResponse(
        audit_stream(request.app.state.database_engine, request.is_disconnected, authorized),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.get("", response_model=list[AuditEventRead])
def list_audit_events(session: Annotated[Session, Depends(get_session)], response: Response):
    response.headers["Cache-Control"] = "no-store"
    rows = session.execute(text(AUDIT_SELECT + ' ORDER BY e.event_time, e.event_id')).mappings()
    return present_events(rows, lambda accounts, workers, patients: session_names(session, accounts, workers, patients))
