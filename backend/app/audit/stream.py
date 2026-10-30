"""Commit notifications from PostgreSQL, delivered as SSE without table polling."""
import asyncio
import hashlib
import json
import time
from uuid import UUID

import psycopg
from psycopg import sql
from psycopg.rows import dict_row
from sqlalchemy import Engine, text

from app.audit.schemas import AuditEventRead
from app.audit.queries import AUDIT_SELECT
from app.audit.presentation import present_events, patient_name


class AuditListener:
    def __init__(self, engine: Engine):
        with engine.connect() as connection:
            schema = connection.scalar(text("SELECT current_schema()"))
        args, kwargs = engine.dialect.create_connect_args(engine.url)
        self.connection = psycopg.connect(*args, **{
            **kwargs, "autocommit": True, "connect_timeout": 5, "row_factory": dict_row,
        })
        try:
            self.connection.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
            self.connection.execute("SET TIME ZONE 'UTC'")
            channel = "psychosis_audit_" + hashlib.md5(schema.encode(), usedforsecurity=False).hexdigest()
            # LISTEN precedes the snapshot, so commits during loading cannot be lost.
            self.connection.execute(sql.SQL("LISTEN {}").format(sql.Identifier(channel)))
        except BaseException:
            self.connection.close()
            raise

    def snapshot(self) -> str:
        rows = self.connection.execute(
            AUDIT_SELECT + ' ORDER BY e.event_time, e.event_id'
        ).fetchall()
        return json.dumps([AuditEventRead.model_validate(row).model_dump(mode="json") for row in self.present(rows)], ensure_ascii=False)

    def present(self, rows):
        def lookup(account_ids, worker_ids, patient_ids):
            accounts = {row['id']: row['username'] for row in self.connection.execute(
                'SELECT id, username FROM user_accounts WHERE id = ANY(%s)', (list(account_ids),)
            ).fetchall()} if account_ids else {}
            workers = {row['id']: f'{row["first_name"]} {row["last_name"]}' for row in self.connection.execute(
                'SELECT id, first_name, last_name FROM medical_workers WHERE id = ANY(%s)', (list(worker_ids),)
            ).fetchall()} if worker_ids else {}
            patients = {row['id']: patient_name(row['first_name'], row['last_name'], row['patronymic']) for row in self.connection.execute(
                'SELECT id, first_name, last_name, patronymic FROM patients WHERE id = ANY(%s)', (list(patient_ids),)
            ).fetchall()} if patient_ids else {}
            return accounts, workers, patients
        return present_events(rows, lookup)

    def wait(self, timeout: float = 1):
        # One network packet may contain several notifications: consume all of it.
        return list(self.connection.notifies(timeout=timeout, stop_after=1))

    def read_event(self, event_id: UUID) -> str | None:
        row = self.connection.execute(
            AUDIT_SELECT + ' WHERE e.event_id = %s', (event_id,),
        ).fetchone()
        return AuditEventRead.model_validate(self.present([row])[0]).model_dump_json() if row else None

    def close(self) -> None:
        self.connection.close()


async def audit_stream(engine: Engine, disconnected, authorized=None):
    listener = None
    try:
        # Blocking psycopg in worker threads also works with Windows Proactor loops.
        listener = await asyncio.to_thread(AuditListener, engine)
        if authorized is not None and not await authorized():
            return
        snapshot = await asyncio.to_thread(listener.snapshot)
        yield f"retry: 1000\nevent: snapshot\ndata: {snapshot}\n\n"
        heartbeat_at = time.monotonic()
        while not await disconnected():
            notifications = await asyncio.to_thread(listener.wait)
            if (notifications or time.monotonic() - heartbeat_at >= 15) and authorized is not None:
                if not await authorized():
                    return
            for notification in notifications:
                try:
                    event_id = UUID(notification.payload)
                except ValueError:
                    continue
                payload = await asyncio.to_thread(listener.read_event, event_id)
                if payload:
                    yield f"event: audit\nid: {event_id}\ndata: {payload}\n\n"
                    heartbeat_at = time.monotonic()
            if not notifications and time.monotonic() - heartbeat_at >= 15:
                yield ": keep-alive\n\n"
                heartbeat_at = time.monotonic()
    except (psycopg.Error, OSError):
        # Closing the stream makes EventSource reconnect and resync from the database.
        return
    finally:
        if listener is not None:
            await asyncio.to_thread(listener.close)
