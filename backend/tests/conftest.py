from collections.abc import Iterator
import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.database import Base
from app.main import create_app
from app.admin_auth.models import Administrator, AdministratorSession
from app.admin_auth.service import SESSION_COOKIE, token_hash, utcnow
from datetime import timedelta


@pytest.fixture
def database_engine() -> Iterator[Engine]:
    postgres_url = os.getenv("TEST_DATABASE_URL")
    if not postgres_url:
        pytest.fail("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database")
    url = make_url(postgres_url)
    if url.drivername != "postgresql+psycopg":
        pytest.fail("TEST_DATABASE_URL must use postgresql+psycopg")
    from app.database import DATABASE_URL
    if url.database == make_url(DATABASE_URL).database:
        pytest.fail("TEST_DATABASE_URL must name a separate test database")
    admin = create_engine(url, connect_args={"connect_timeout": 5})
    schema = "test_" + uuid4().hex
    test_engine = create_engine(url, connect_args={
        "connect_timeout": 5, "options": f"-csearch_path={schema} -ctimezone=UTC",
    })
    created = False
    try:
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        created = True
        Base.metadata.create_all(test_engine)
        yield test_engine
    finally:
        test_engine.dispose()
        try:
            if created:
                with admin.begin() as connection:
                    connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            admin.dispose()


@pytest.fixture
def admin_cookie(database_engine):
    # Existing business tests exercise real session authorization without a login event
    # in their initial journal. Setup/password/TOTP are covered by test_admin_auth.py.
    from app.schema import initialize_database
    from app.admin_auth.service import create_session
    from fastapi import Request, Response
    initialize_database(database_engine)
    response = Response()
    with Session(database_engine) as session:
        session.add(Administrator(password_hash='fixture-not-a-password-hash',
            totp_secret='JBSWY3DPEHPK3PXP', last_totp_step=-1, configured_at=utcnow()))
        session.flush()
        create_session(session, Request({'type': 'http', 'scheme': 'http', 'path': '/', 'query_string': b'', 'server': ('testserver', 80), 'headers': []}), response)
        session.commit()
    from http.cookies import SimpleCookie
    cookies = SimpleCookie()
    for value in response.headers.getlist('set-cookie'): cookies.load(value)
    return {name: item.value for name, item in cookies.items()}


@pytest.fixture
def client(database_engine: Engine, admin_cookie) -> Iterator[TestClient]:
    with TestClient(create_app(database_engine), cookies=admin_cookie) as test_client:
        yield test_client


@pytest.fixture
def clinical_client(database_engine, admin_cookie):
    from app.accounts.models import UserAccount
    from app.accounts.passwords import hash_password
    from app.medical_workers.models import MedicalWorker
    password = 'Fixture-Doctor-Password'
    with Session(database_engine) as session:
        worker = MedicalWorker(first_name='Грегори', last_name='Хаус', position='Врач-диагност', role='doctor')
        session.add(worker)
        session.flush()
        worker_id = worker.id
        session.add(UserAccount(username='fixtureDoctor', password_hash=hash_password(password), medical_worker_id=worker_id))
        session.commit()
    with TestClient(create_app(database_engine), cookies=admin_cookie) as test_client:
        assert test_client.post('/api/user-auth/login', json={'username': 'fixtureDoctor', 'password': password}).status_code == 200
        test_client.current_worker = test_client.get(f'/api/medical-workers/{worker_id}').json()
        yield test_client
