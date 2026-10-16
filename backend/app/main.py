from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import Engine

from app.database import Base, engine
from app.diagnoses.router import router as diagnoses_router
from app.medical_workers.router import router as medical_workers_router
from app.medical_records.router import router as medical_records_router
from app.medical_records.history import backfill_history
from app.patients.router import router as patients_router


def create_app(database_engine: Engine = engine) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        Base.metadata.create_all(bind=database_engine)
        backfill_history(database_engine)
        yield

    application = FastAPI(title="PsychosIS API", lifespan=lifespan)
    application.state.database_engine = database_engine
    application.include_router(medical_workers_router)
    application.include_router(diagnoses_router)
    application.include_router(patients_router)
    application.include_router(medical_records_router)

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
