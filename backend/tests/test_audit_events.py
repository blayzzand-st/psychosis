import asyncio
import json
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.models import AuditEvent
from app.audit.service import audit_subscriber
from app.audit.stream import AuditListener, audit_stream
from app.events import DomainEvent, EventBus, EventKind, emit_event
from app.schema import initialize_database


def test_bus_dispatches_named_events_to_subscribers_in_transaction(database_engine):
    bus = EventBus()
    received = []
    bus.subscribe(EventKind.PATIENT_CREATED, audit_subscriber)
    bus.subscribe(EventKind.PATIENT_CREATED, lambda session, event: received.append(event))
    with Session(database_engine) as session:
        event = DomainEvent(EventKind.PATIENT_CREATED, 'system:test', 12)
        bus.publish(session, event)
        session.flush()
        assert received == [event]
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 1
        session.rollback()
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 0


def test_notifications_wait_for_commit_and_rollback_is_silent(database_engine):
    initialize_database(database_engine)
    listener = AuditListener(database_engine)
    try:
        with Session(database_engine) as session:
            emit_event(session, EventKind.PATIENT_CREATED, 1)
            session.flush()
            assert listener.wait(timeout=0.05) == []
            session.rollback()
        assert listener.wait(timeout=0.05) == []
        with Session(database_engine) as session:
            emit_event(session, EventKind.PATIENT_CREATED, 2)
            emit_event(session, EventKind.PATIENT_UPDATED, 2)
            session.flush()
            ids = {str(value) for value in session.scalars(select(AuditEvent.event_id))}
            session.commit()
        notifications = listener.wait(timeout=1)
        assert {note.payload for note in notifications} == ids
        assert listener.read_event(uuid4()) is None
        for note in notifications:
            entry = json.loads(listener.read_event(note.payload))
            assert entry['event_id'] == note.payload
    finally:
        listener.close()


def test_listen_before_snapshot_and_reconnection_restore_history(database_engine):
    initialize_database(database_engine)
    listener = AuditListener(database_engine)
    try:
        with Session(database_engine) as session:
            emit_event(session, EventKind.WORKER_CREATED, 17)
            session.commit()
        snapshot = json.loads(listener.snapshot())
        assert snapshot[0]['message'] == 'Добавлен медработник 17'
        assert listener.wait(timeout=1)[0].payload == snapshot[0]['event_id']
    finally:
        listener.close()
    # A commit while no stream exists is recovered from the next snapshot.
    with Session(database_engine) as session:
        emit_event(session, EventKind.WORKER_UPDATED, 17)
        session.commit()
    listener = AuditListener(database_engine)
    try:
        assert len(json.loads(listener.snapshot())) == 2
    finally:
        listener.close()


def test_sse_stream_snapshot_then_immediate_commit_event(database_engine):
    initialize_database(database_engine)

    async def run():
        async def connected():
            return False
        stream = audit_stream(database_engine, connected)
        try:
            first = await anext(stream)
            assert 'event: snapshot\ndata: []' in first
            with Session(database_engine) as session:
                emit_event(session, EventKind.ACCOUNT_ACTIVATED, uuid4())
                session.commit()
            frame = await asyncio.wait_for(anext(stream), timeout=2)
            assert 'event: audit\n' in frame
            data = json.loads(frame.split('data: ', 1)[1])
            assert 'активирован' in data['message']
            assert data['event_id'] in frame
        finally:
            await stream.aclose()
    asyncio.run(run())


def test_subscriber_failure_does_not_commit_business_change(database_engine):
    bus = EventBus()
    def fail(_session, _event):
        raise RuntimeError('subscriber failed')
    bus.subscribe(EventKind.PATIENT_CREATED, audit_subscriber)
    bus.subscribe(EventKind.PATIENT_CREATED, fail)
    with Session(database_engine) as session:
        with pytest.raises(RuntimeError):
            with session.begin():
                bus.publish(session, DomainEvent(EventKind.PATIENT_CREATED, 'system:test', 5))
        assert session.scalar(select(func.count()).select_from(AuditEvent)) == 0


def test_http_stream_receives_committed_operation_in_under_two_seconds(database_engine, admin_cookie):
    import socket
    import threading
    import time
    import urllib.request
    import uvicorn
    from app.main import create_app

    def frame(response):
        result = {}
        while True:
            line = response.readline().decode().strip()
            if not line and result.get('data') is not None:
                return result
            if ': ' in line:
                key, value = line.split(': ', 1)
                result[key] = value

    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(create_app(database_engine), log_level='error', timeout_graceful_shutdown=2))
        thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started:
                if time.monotonic() > deadline:
                    raise RuntimeError('Test server did not start')
                time.sleep(0.01)
            base = f'http://127.0.0.1:{port}'
            cookie = '; '.join(f'{key}={value}' for key, value in admin_cookie.items())
            stream_request = urllib.request.Request(base + '/api/audit/stream', headers={'Cookie': cookie})
            with urllib.request.urlopen(stream_request, timeout=3) as stream:
                assert stream.headers.get_content_type() == 'text/event-stream'
                assert stream.headers['X-Accel-Buffering'] == 'no'
                assert frame(stream)['event'] == 'snapshot'
                started = time.monotonic()
                request = urllib.request.Request(base + '/api/medical-workers', method='POST',
                    headers={'Content-Type': 'application/json', 'Cookie': cookie},
                    data=json.dumps({'first_name': 'Иван', 'last_name': 'Петров', 'position': 'Врач'}).encode())
                with urllib.request.urlopen(request, timeout=3) as response:
                    assert response.status == 201
                event = frame(stream)
                assert time.monotonic() - started < 2
                assert event['event'] == 'audit'
                assert 'Добавлен медработник' in json.loads(event['data'])['message']
                logout = urllib.request.Request(base + '/api/admin-auth/logout', method='POST', headers={'Cookie': cookie})
                with urllib.request.urlopen(logout, timeout=3) as response:
                    assert response.status == 204
                with Session(database_engine) as session:
                    emit_event(session, EventKind.WORKER_UPDATED, 1, actor='system:test')
                    session.commit()
                # A connected client with a revoked cookie cannot receive more audit data.
                assert stream.readline() == b''
        finally:
            server.should_exit = True
            thread.join(timeout=6)
            assert not thread.is_alive()
