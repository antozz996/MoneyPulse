from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


GoalKind = Literal["goal", "safety_buffer"]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    target_amount: float = Field(ge=0)
    planned_contribution: float = Field(ge=0, default=0)
    reserved_amount: float = Field(ge=0, default=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    kind: GoalKind = "goal"


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_amount: float
    planned_contribution: float
    reserved_amount: float
    currency: str
    kind: GoalKind
    created_at: datetime
