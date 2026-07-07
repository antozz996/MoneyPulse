from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.schemas.coach import (
    CoachDecisionExplainRead,
    CoachTodaySummaryRead,
    CoachWeeklySummaryRead,
)
from app.schemas.decisioning import BeforeYouBuyRead, TodayRead


def _format_money(amount: float, currency: str) -> str:
    return f"{amount:.2f} {currency.upper()}"


@dataclass(frozen=True)
class UpcomingItem:
    date: date
    label: str
    amount: float
    direction: str
    currency: str


@dataclass(frozen=True)
class TodayCoachContext:
    today: TodayRead


@dataclass(frozen=True)
class DecisionCoachContext:
    today: TodayRead
    decision: BeforeYouBuyRead
    purchase_description: str | None


@dataclass(frozen=True)
class WeeklyCoachContext:
    today: TodayRead
    period_start: date
    period_end: date
    documented_income: float
    documented_outgoing: float
    upcoming_items: tuple[UpcomingItem, ...]


class CoachProvider(Protocol):
    source: str

    def summarize_today(self, context: TodayCoachContext) -> CoachTodaySummaryRead:
        ...

    def explain_decision(
        self,
        context: DecisionCoachContext,
    ) -> CoachDecisionExplainRead:
        ...

    def summarize_weekly(self, context: WeeklyCoachContext) -> CoachWeeklySummaryRead:
        ...


def _risk_summary(risk_level: str) -> str:
    if risk_level == "safe":
        return "safe"
    if risk_level == "caution":
        return "tight"
    return "under pressure"


def _top_today_drivers(today: TodayRead) -> list[tuple[str, float, str]]:
    drivers = [
        ("available balance", today.inputs.available_balance, "support"),
        ("expected income today", today.inputs.expected_income_today, "support"),
        ("essential obligations", today.inputs.essential_obligations, "pressure"),
        ("committed spending", today.inputs.committed_spending, "pressure"),
        ("safety buffer", today.inputs.safety_buffer, "pressure"),
        ("planned goal contribution", today.inputs.planned_goal_contribution, "pressure"),
    ]
    return [
        item
        for item in sorted(drivers, key=lambda driver: (-driver[1], driver[0]))
        if item[1] > 0
    ]


class DeterministicCoachProvider:
    source = "deterministic"

    def summarize_today(self, context: TodayCoachContext) -> CoachTodaySummaryRead:
        today = context.today
        currency = today.currency
        drivers = _top_today_drivers(today)
        why = [
            f"MoneyPulse marks today as {today.risk_level} because { _format_money(today.available_to_spend_today, currency) } remains after documented obligations, safety buffer, and goals.",
            *[
                f"{label.title()} contributes { _format_money(amount, currency) } of {kind}."
                for label, amount, kind in drivers[:2]
            ],
        ]

        what_changed: list[str] = []
        if today.inputs.expected_income_today > 0:
            what_changed.append(
                f"Expected income today adds { _format_money(today.inputs.expected_income_today, currency) } of support."
            )
        if today.inputs.essential_obligations > 0:
            what_changed.append(
                f"Essential obligations due today remove { _format_money(today.inputs.essential_obligations, currency) } of room."
            )
        if today.inputs.committed_spending > 0:
            what_changed.append(
                f"Committed spending removes { _format_money(today.inputs.committed_spending, currency) } of room."
            )
        if not what_changed:
            what_changed.append(
                "No additional income or due obligations are changing the baseline today."
            )

        next_steps = [
            "Use Before You Buy for any new discretionary purchase you are about to make.",
            "Refresh balances or commitments if any number feels outdated.",
        ]
        if today.risk_level == "caution":
            next_steps.insert(0, "Prioritize essentials and already-committed spending first.")
        elif today.risk_level == "hold":
            next_steps.insert(0, "Pause optional spending until income lands or pressure clears.")
        else:
            next_steps.insert(0, "Keep the current buffer intact if a bigger expense might still happen today.")

        return CoachTodaySummaryRead(
            source=self.source,
            summary=(
                f"Today looks {_risk_summary(today.risk_level)} with "
                f"{_format_money(today.available_to_spend_today, currency)} available to spend."
            ),
            why=why[:3],
            what_changed=what_changed[:3],
            next_steps=next_steps[:3],
            model_version=today.model_version,
            risk_level=today.risk_level,
            available_to_spend_today=today.available_to_spend_today,
            currency=currency,
        )

    def explain_decision(
        self,
        context: DecisionCoachContext,
    ) -> CoachDecisionExplainRead:
        today = context.today
        decision = context.decision
        currency = decision.currency
        item_name = context.purchase_description or "this purchase"

        if today.risk_level == decision.decision:
            decision_shift = f"The decision stays {decision.decision} after adding {item_name}."
        else:
            decision_shift = (
                f"The decision moves from {today.risk_level} to {decision.decision} after adding {item_name}."
            )

        why = [
            f"Current discretionary headroom is { _format_money(decision.current_available_to_spend, currency) }.",
            f"{item_name.capitalize()} would reduce that room by { _format_money(decision.purchase_amount, currency) }.",
            *decision.explanations[:1],
        ]
        what_changed = [
            f"Remaining room after the purchase would be { _format_money(decision.available_to_spend_after_purchase, currency) }.",
            f"The documented change is { _format_money(decision.delta, currency) } compared with today's baseline.",
            decision_shift,
        ]
        next_steps = [
            "Only treat this as affordable if the balances and commitments shown in Money are current.",
        ]
        if decision.decision == "safe":
            next_steps.append("If the purchase is still optional, compare it against your next checkpoint before confirming.")
        elif decision.decision == "caution":
            next_steps.append("Consider lowering the amount or delaying the purchase if it is optional.")
        else:
            next_steps.append("Wait until more income lands or obligations clear before buying it.")

        return CoachDecisionExplainRead(
            source=self.source,
            summary=(
                f"{item_name.capitalize()} looks {_risk_summary(decision.decision)} because "
                f"{_format_money(decision.available_to_spend_after_purchase, currency)} would remain after it."
            ),
            why=why[:3],
            what_changed=what_changed[:3],
            next_steps=next_steps[:3],
            model_version=decision.model_version,
            baseline_risk_level=today.risk_level,
            decision=decision.decision,
            current_available_to_spend=decision.current_available_to_spend,
            purchase_amount=decision.purchase_amount,
            available_to_spend_after_purchase=decision.available_to_spend_after_purchase,
            delta=decision.delta,
            can_afford=decision.can_afford,
            currency=currency,
        )

    def summarize_weekly(self, context: WeeklyCoachContext) -> CoachWeeklySummaryRead:
        today = context.today
        currency = today.currency
        net_flow = round(context.documented_income - context.documented_outgoing, 2)
        upcoming_labels = [
            f"{item.label} on {item.date.isoformat()} ({_format_money(item.amount, item.currency)})"
            for item in context.upcoming_items[:3]
        ]

        if net_flow > 0:
            summary = (
                f"The next 7 days add net support of {_format_money(net_flow, currency)} "
                f"against today's {today.risk_level} baseline."
            )
        elif net_flow < 0:
            summary = (
                f"The next 7 days add net pressure of {_format_money(abs(net_flow), currency)} "
                f"against today's {today.risk_level} baseline."
            )
        else:
            summary = "The next 7 days are balanced on documented income and outgoing items."

        why = [
            f"Today's baseline remains {today.risk_level} with { _format_money(today.available_to_spend_today, currency) } available to spend.",
            f"Documented income across the next 7 days totals { _format_money(context.documented_income, currency) }.",
            f"Documented outgoing items across the next 7 days total { _format_money(context.documented_outgoing, currency) }.",
        ]
        what_changed = (
            upcoming_labels
            if upcoming_labels
            else ["No future transaction or recurring event is documented for the next 7 days."]
        )
        next_steps = [
            "Review upcoming items in Money if any timing or amount has changed.",
            "Use Before You Buy again if a new purchase would land before the next weekly pressure point.",
        ]
        if context.documented_outgoing > context.documented_income:
            next_steps.insert(0, "Keep extra margin for the heavier outgoing week ahead.")
        else:
            next_steps.insert(0, "The documented week stays manageable if no new pressure is added.")

        return CoachWeeklySummaryRead(
            source=self.source,
            summary=summary,
            why=why,
            what_changed=what_changed[:3],
            next_steps=next_steps[:3],
            model_version=today.model_version,
            period_start=context.period_start,
            period_end=context.period_end,
            risk_level=today.risk_level,
            current_available_to_spend=today.available_to_spend_today,
            documented_income=context.documented_income,
            documented_outgoing=context.documented_outgoing,
            upcoming_items_count=len(context.upcoming_items),
            currency=currency,
        )


class OptionalLlmCoachProvider:
    source = "llm"

    def summarize_today(self, context: TodayCoachContext) -> CoachTodaySummaryRead:
        raise RuntimeError("The optional LLM coach provider is disabled.")

    def explain_decision(
        self,
        context: DecisionCoachContext,
    ) -> CoachDecisionExplainRead:
        raise RuntimeError("The optional LLM coach provider is disabled.")

    def summarize_weekly(self, context: WeeklyCoachContext) -> CoachWeeklySummaryRead:
        raise RuntimeError("The optional LLM coach provider is disabled.")


@dataclass(frozen=True)
class CoachProviders:
    default_provider_name: str
    llm_enabled: bool
    providers: dict[str, CoachProvider]

    def resolve(self) -> CoachProvider:
        provider_name = self.default_provider_name.strip().lower()

        if provider_name == "llm" and self.llm_enabled:
            llm_provider = self.providers.get("llm")
            if llm_provider is not None:
                return llm_provider

        deterministic_provider = self.providers.get("deterministic")
        if deterministic_provider is None:
            raise RuntimeError("Deterministic coach provider is not configured.")
        return deterministic_provider
