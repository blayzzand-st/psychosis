from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints


_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
AuditActor = Annotated[
    str,
    StringConstraints(
        max_length=128,
        pattern=rf"^(account:{_UUID}|anonymous:{_UUID}|system:[a-z][a-z0-9_.-]{{0,63}})$",
    ),
]


class AuditEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: UUID
    event_time: datetime
    actor: AuditActor
    actor_label: str | None = None
    message: str
    display_message: str | None = None
