from collections.abc import Iterator
import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url

from app.database import Base
from app.main import create_app


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
def client(database_engine: Engine) -> Iterator[TestClient]:
    with TestClient(create_app(database_engine)) as test_client:
        yield test_client
