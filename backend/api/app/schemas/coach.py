from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.decisioning import DecisionLabel


CoachSource = Literal["deterministic", "llm"]


class CoachNarrativeRead(BaseModel):
    source: CoachSource
    summary: str
    why: list[str]
    what_changed: list[str]
    next_steps: list[str]
    model_version: str


class CoachTodaySummaryRead(CoachNarrativeRead):
    risk_level: DecisionLabel
    available_to_spend_today: float
    currency: str


class CoachDecisionExplainRead(CoachNarrativeRead):
    baseline_risk_level: DecisionLabel
    decision: DecisionLabel
    current_available_to_spend: float
    purchase_amount: float
    available_to_spend_after_purchase: float
    delta: float
    can_afford: bool
    currency: str


class CoachWeeklySummaryRead(CoachNarrativeRead):
    period_start: date
    period_end: date
    risk_level: DecisionLabel
    current_available_to_spend: float
    documented_income: float
    documented_outgoing: float
    upcoming_items_count: int = Field(ge=0)
    currency: str
