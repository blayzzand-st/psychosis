from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints


Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=16)]


class UserAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: Username
    created_at: datetime
    updated_at: datetime
    is_active: bool
    medical_worker_id: int | None
