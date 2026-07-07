from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_text(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Value must not be empty.")
    return normalized


def normalize_currency(value: str) -> str:
    normalized = value.strip().upper()
    if len(normalized) != 3:
        raise ValueError("Currency must be a 3-letter code.")
    return normalized


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    balance: float = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class AccountUpdate(AccountCreate):
    pass


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    balance: float
    currency: str
    source: str
    created_at: datetime
