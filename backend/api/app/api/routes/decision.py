from fastapi import APIRouter

from app.schemas.decision import DecisionInput, DecisionOutput

router = APIRouter(prefix="/v1/decision", tags=["decision"])


@router.post("/briefing", response_model=DecisionOutput)
def create_briefing(payload: DecisionInput) -> DecisionOutput:
    safe_to_spend = max(
        0.0,
        payload.available_balance
        + payload.expected_income_today
        - payload.essential_obligations
        - payload.committed_spending
        - payload.safety_buffer
        - payload.planned_goal_contribution,
    )

    if safe_to_spend == 0:
        risk_level = "hold"
    elif safe_to_spend < 150:
        risk_level = "caution"
    else:
        risk_level = "safe"

    explanations = [
        f"Started from {payload.currency} {payload.available_balance:.2f} available today.",
        f"Accounted for {payload.currency} {payload.committed_spending:.2f} already committed to discretionary spending.",
        f"Reserved {payload.currency} {payload.essential_obligations:.2f} for essentials and {payload.currency} {payload.safety_buffer:.2f} as buffer.",
        f"Protected {payload.currency} {payload.planned_goal_contribution:.2f} for goals before discretionary spending.",
    ]

    return DecisionOutput(
        currency=payload.currency,
        safe_to_spend_today=round(safe_to_spend, 2),
        risk_level=risk_level,
        explanations=explanations,
        model_version=payload.model_version,
    )
