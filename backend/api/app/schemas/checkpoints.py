from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CheckpointCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    amount: float = Field(ge=0, default=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    effective_date: date
    note: str | None = Field(default=None, max_length=255)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Checkpoint name must not be empty.")
        return normalized

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3:
            raise ValueError("Currency must be a 3-letter code.")
        return normalized

    @field_validator("note")
    @classmethod
    def validate_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class CheckpointUpdate(CheckpointCreate):
    pass


class CheckpointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    amount: float
    currency: str
    effective_date: date
    note: str | None
    created_at: datetime
