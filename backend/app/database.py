from collections.abc import Iterator
from pathlib import Path
import os

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import DeclarativeBase, Session
from dotenv import load_dotenv


class Base(DeclarativeBase):
    pass


BACKEND_PATH = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_PATH / ".env")
DATABASE_URL = os.getenv("DATABASE_URL") or URL.create(
    "postgresql+psycopg",
    username=os.getenv("PGUSER", "psychosis"),
    password=os.getenv("PGPASSWORD"),
    host=os.getenv("PGHOST", "127.0.0.1"),
    port=int(os.getenv("PGPORT", "5432")),
    database=os.getenv("PGDATABASE", "psychosis"),
).render_as_string(hide_password=False)
if make_url(DATABASE_URL).drivername != "postgresql+psycopg":
    raise ValueError("DATABASE_URL must use postgresql+psycopg")
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.database_engine) as session:
        yield session
