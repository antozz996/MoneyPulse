from typing import Literal

from pydantic import BaseModel, Field


class DecisionInput(BaseModel):
    available_balance: float = Field(ge=0)
    expected_income_today: float = Field(ge=0, default=0)
    essential_obligations: float = Field(ge=0)
    committed_spending: float = Field(ge=0, default=0)
    safety_buffer: float = Field(ge=0)
    planned_goal_contribution: float = Field(ge=0, default=0)
    currency: str = Field(min_length=3, max_length=3)
    model_version: str = Field(default="1.0.0")


class DecisionOutput(BaseModel):
    currency: str
    safe_to_spend_today: float
    risk_level: Literal["safe", "caution", "hold"]
    explanations: list[str]
    model_version: str

