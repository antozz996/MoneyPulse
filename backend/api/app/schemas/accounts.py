from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    balance: float = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    balance: float
    currency: str
    created_at: datetime
