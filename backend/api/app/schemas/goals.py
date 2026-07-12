from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.accounts import normalize_currency, normalize_text


GoalKind = Literal["goal", "safety_buffer"]
GoalPriority = Literal["ESSENTIAL", "IMPORTANT", "FLEXIBLE"]


def _normalize_goal_payload(data: Any) -> Any:
    if not isinstance(data, dict):
        return data

    normalized = dict(data)
    if "current_amount" not in normalized and "reserved_amount" in normalized:
        normalized["current_amount"] = normalized["reserved_amount"]
    if "monthly_contribution" not in normalized and "planned_contribution" in normalized:
        normalized["monthly_contribution"] = normalized["planned_contribution"]
    if "priority" not in normalized and normalized.get("kind") == "safety_buffer":
        normalized["priority"] = "ESSENTIAL"
    return normalized


class GoalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    target_amount: float = Field(ge=0)
    current_amount: float = Field(ge=0, default=0)
    monthly_contribution: float = Field(ge=0, default=0)
    planned_contribution: float | None = Field(default=None, ge=0)
    reserved_amount: float | None = Field(default=None, ge=0)
    priority: GoalPriority = "IMPORTANT"
    deadline: date | None = None
    status: str = Field(min_length=1, max_length=32, default="active")
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    kind: GoalKind = "goal"

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        return _normalize_goal_payload(data)

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
            raise ValueError("Goal status must not be empty.")
        return normalized


class GoalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    target_amount: float | None = Field(default=None, ge=0)
    current_amount: float | None = Field(default=None, ge=0)
    monthly_contribution: float | None = Field(default=None, ge=0)
    planned_contribution: float | None = Field(default=None, ge=0)
    reserved_amount: float | None = Field(default=None, ge=0)
    priority: GoalPriority | None = None
    deadline: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    kind: GoalKind | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        return _normalize_goal_payload(data)

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
            raise ValueError("Goal status must not be empty.")
        return normalized


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_amount: float
    current_amount: float
    monthly_contribution: float
    planned_contribution: float
    reserved_amount: float
    currency: str
    kind: GoalKind
    priority: GoalPriority
    deadline: date | None
    status: str
    created_at: datetime
    updated_at: datetime
