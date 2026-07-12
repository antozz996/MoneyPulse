from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.accounts import normalize_currency, normalize_text


RecurringEventDirection = Literal["income", "expense"]
RecurringEventCategory = Literal["essential", "committed"]
RecurringEventCadence = Literal["daily", "weekly", "monthly"]


def _normalize_recurring_payload(data: Any) -> Any:
    if not isinstance(data, dict):
        return data

    normalized = dict(data)
    if "type" not in normalized and "direction" in normalized:
        normalized["type"] = normalized["direction"]
    if "direction" not in normalized and "type" in normalized:
        normalized["direction"] = normalized["type"]
    if "frequency" not in normalized and "cadence" in normalized:
        normalized["frequency"] = normalized["cadence"]
    if "cadence" not in normalized and "frequency" in normalized:
        normalized["cadence"] = normalized["frequency"]
    if "next_due_date" not in normalized and "start_date" in normalized:
        normalized["next_due_date"] = normalized["start_date"]
    if "start_date" not in normalized and "next_due_date" in normalized:
        normalized["start_date"] = normalized["next_due_date"]
    if "status" not in normalized and "active" in normalized:
        normalized["status"] = "active" if normalized["active"] else "paused"
    if "active" not in normalized and "status" in normalized:
        normalized["active"] = normalized["status"] == "active"
    return normalized


class RecurringEventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    name: str = Field(min_length=1, max_length=255)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    type: RecurringEventDirection
    direction: RecurringEventDirection
    category: RecurringEventCategory | None = None
    frequency: RecurringEventCadence
    cadence: RecurringEventCadence
    next_due_date: date
    start_date: date
    active: bool = True
    status: str = Field(min_length=1, max_length=32, default="active")

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        return _normalize_recurring_payload(data)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Recurring item status must not be empty.")
        return normalized

    @model_validator(mode="after")
    def validate_category(self) -> "RecurringEventCreate":
        if self.direction == "income" and self.category is not None:
            raise ValueError("Income recurring events cannot include an expense category.")
        return self


class RecurringEventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    type: RecurringEventDirection | None = None
    direction: RecurringEventDirection | None = None
    category: RecurringEventCategory | None = None
    frequency: RecurringEventCadence | None = None
    cadence: RecurringEventCadence | None = None
    next_due_date: date | None = None
    start_date: date | None = None
    active: bool | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        return _normalize_recurring_payload(data)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_currency(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Recurring item status must not be empty.")
        return normalized


class RecurringEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int | None
    category_id: int | None
    name: str
    amount: float
    currency: str
    type: RecurringEventDirection
    direction: RecurringEventDirection
    category: RecurringEventCategory | None
    frequency: RecurringEventCadence
    cadence: RecurringEventCadence
    next_due_date: date | None
    start_date: date
    active: bool
    status: str
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            normalized = {
                "id": data.id,
                "account_id": data.account_id,
                "category_id": data.category_id,
                "name": data.name,
                "amount": data.amount,
                "currency": data.currency,
                "type": data.direction,
                "direction": data.direction,
                "category": data.category,
                "frequency": data.cadence,
                "cadence": data.cadence,
                "next_due_date": data.next_due_date,
                "start_date": data.start_date,
                "active": data.active,
                "status": data.status,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
            return normalized
        return _normalize_recurring_payload(data)
