from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


CopilotIntent = Literal[
    "health_check",
    "affordability_check",
    "budget_analysis",
    "goal_analysis",
    "forecast_check",
    "survival_plan",
    "unknown",
]
CopilotProviderSource = Literal["mock", "openai"]
DecisionLevel = Literal["GREEN", "YELLOW", "RED", "BLACK"]
DecisionStatus = Literal["ALLOW", "ALLOW_WITH_CAUTION", "NOT_RECOMMENDED", "BLOCKED"]
BudgetHealth = Literal["HEALTHY", "NEAR_LIMIT", "OVER_LIMIT"]


class CopilotHistoryMessageCreate(BaseModel):
    role: Literal["assistant", "user"]
    text: str = Field(min_length=1, max_length=1000)


class CopilotChatCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    locale: str = Field(min_length=2, max_length=16)
    history: list[CopilotHistoryMessageCreate] = Field(default_factory=list, max_length=50)


class CopilotEntitiesRead(BaseModel):
    amount: float | None = None
    currency: str | None = None


class CopilotClassificationRead(BaseModel):
    intent: CopilotIntent
    confidence: float = Field(ge=0.0, le=1.0)
    entities: CopilotEntitiesRead


class CopilotMoneyAmountRead(BaseModel):
    amount: float
    currency: str


class CopilotSnapshotSummaryRead(BaseModel):
    cycle_start: date
    cycle_end: date
    real_availability_now: CopilotMoneyAmountRead
    projected_availability: CopilotMoneyAmountRead
    safe_daily_spend: CopilotMoneyAmountRead
    decision_level: DecisionLevel


class CopilotBudgetSummaryRead(BaseModel):
    overall: BudgetHealth
    over_limit_categories: list[str]
    near_limit_categories: list[str]


class CopilotGoalSummaryRead(BaseModel):
    essential_covered: bool
    important_covered: bool
    flexible_deferred: bool
    remaining_this_cycle: CopilotMoneyAmountRead


class CopilotRecentDecisionSummaryRead(BaseModel):
    level: DecisionLevel
    status: DecisionStatus
    purchase_amount: CopilotMoneyAmountRead
    remaining_after_purchase: CopilotMoneyAmountRead


class CopilotContextRead(BaseModel):
    locale: str
    currency: str
    risk_profile: Literal["BALANCED"]
    snapshot_summary: CopilotSnapshotSummaryRead
    budget_summary: CopilotBudgetSummaryRead
    goal_summary: CopilotGoalSummaryRead
    recent_decision_summary: CopilotRecentDecisionSummaryRead | None = None


class CopilotReplyRead(BaseModel):
    provider: CopilotProviderSource
    model_version: str
    fallback_used: bool = False
    model: str | None = None
    intent: CopilotIntent
    answer: str
    classification: CopilotClassificationRead
    context: CopilotContextRead
