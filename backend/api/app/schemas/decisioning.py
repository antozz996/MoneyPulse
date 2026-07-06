from typing import Literal

from pydantic import BaseModel, Field


DecisionLabel = Literal["safe", "caution", "hold"]


class DecisionConfidenceRead(BaseModel):
    mode: Literal["deterministic"]
    input_completeness: Literal["complete"]
    uses_documented_inputs_only: bool
    purchase_context: Literal["not-provided", "matched-currency"]
    supported_inputs: list[str]
    model_version: str


class TodayInputsRead(BaseModel):
    available_balance: float
    expected_income_today: float
    essential_obligations: float
    committed_spending: float
    safety_buffer: float
    planned_goal_contribution: float


class TodayRead(BaseModel):
    available_to_spend_today: float
    risk_level: DecisionLabel
    currency: str
    model_version: str
    explanations: list[str]
    inputs: TodayInputsRead
    confidence: DecisionConfidenceRead


class BeforeYouBuyCreate(BaseModel):
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    description: str | None = Field(default=None, max_length=255)


class BeforeYouBuyRead(BaseModel):
    current_available_to_spend: float
    purchase_amount: float
    available_to_spend_after_purchase: float
    delta: float
    can_afford: bool
    decision: DecisionLabel
    currency: str
    model_version: str
    explanations: list[str]
    confidence: DecisionConfidenceRead
