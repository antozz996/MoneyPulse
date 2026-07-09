from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import re
from typing import Protocol

from app.schemas.copilot import (
    CopilotChatCreate,
    CopilotClassificationRead,
    CopilotContextRead,
    CopilotEntitiesRead,
    CopilotReplyRead,
)
from app.schemas.decisioning import BeforeYouBuyRead, TodayRead


def _normalize_locale(locale: str) -> str:
    normalized = locale.strip().lower()
    return normalized if normalized else "en"


def _is_italian(locale: str) -> bool:
    return _normalize_locale(locale).startswith("it")


def _format_money(amount: float, currency: str) -> str:
    return f"{amount:.2f} {currency.upper()}"


def _parse_amount(message: str) -> float | None:
    match = re.search(r"(\d+(?:[.,]\d+)?)", message)
    if match is None:
        return None
    return round(float(match.group(1).replace(",", ".")), 2)


def _parse_currency(message: str) -> str | None:
    lowered = message.lower()
    if any(token in lowered for token in ("euro", "eur", "€")):
        return "EUR"
    if any(token in lowered for token in ("usd", "dollar", "$")):
        return "USD"
    if any(token in lowered for token in ("gbp", "pound", "£")):
        return "GBP"
    return None


def classify_copilot_message(message: str) -> CopilotClassificationRead:
    lowered = message.strip().lower()
    amount = _parse_amount(lowered)
    currency = _parse_currency(lowered)

    candidates: list[tuple[str, float, tuple[str, ...]]] = [
        ("survival_plan", 0.95, ("piano", "stipendio", "until payday", "fino allo stipendio")),
        ("affordability_check", 0.94, ("posso spendere", "can i spend", "afford", "buy", "comprare")),
        ("budget_analysis", 0.90, ("budget", "spendendo troppo", "spendo troppo", "over budget", "too much")),
        ("goal_analysis", 0.90, ("obiettiv", "goals", "risparmio", "saving goal")),
        ("forecast_check", 0.88, ("come chiudo il mese", "chiudo il mese", "forecast", "end of month", "next paycheck")),
        ("health_check", 0.84, ("come sto andando", "come va", "how am i doing", "health check", "come sono messo")),
    ]

    for intent, confidence, patterns in candidates:
        if any(pattern in lowered for pattern in patterns):
            return CopilotClassificationRead(
                intent=intent,
                confidence=confidence,
                entities=CopilotEntitiesRead(amount=amount, currency=currency),
            )

    return CopilotClassificationRead(
        intent="unknown",
        confidence=0.25,
        entities=CopilotEntitiesRead(amount=amount, currency=currency),
    )


@dataclass(frozen=True)
class CopilotGoalState:
    goals_count: int
    safety_buffer_reserved: float
    planned_goal_contribution: float


@dataclass(frozen=True)
class CopilotProviderContext:
    request: CopilotChatCreate
    classification: CopilotClassificationRead
    safe_context: CopilotContextRead
    today: TodayRead
    goal_state: CopilotGoalState
    upcoming_items_count: int
    documented_income: float
    documented_outgoing: float
    purchase_decision: BeforeYouBuyRead | None


class CopilotProvider(Protocol):
    source: str

    def generate_reply(self, context: CopilotProviderContext) -> CopilotReplyRead:
        ...


def _decision_level(decision: str) -> str:
    if decision == "safe":
        return "GREEN"
    if decision == "caution":
        return "YELLOW"
    return "RED"


class DeterministicCopilotProvider:
    source = "mock"
    model_version = "deterministic-mock-v1"

    def generate_reply(self, context: CopilotProviderContext) -> CopilotReplyRead:
        locale = context.request.locale
        currency = context.today.currency
        classification = context.classification
        today = context.today

        if classification.intent == "health_check":
            answer = (
                f"Oggi la disponibilita' reale e' {_format_money(today.available_to_spend_today, currency)} "
                f"dopo obblighi documentati, buffer e obiettivi."
                if _is_italian(locale)
                else f"Real availability today is {_format_money(today.available_to_spend_today, currency)} after documented obligations, buffer, and goals."
            )
        elif classification.intent == "affordability_check":
            if context.purchase_decision is None:
                answer = (
                    "Mi manca l'importo da simulare. Dimmi quanto vuoi spendere."
                    if _is_italian(locale)
                    else "I am missing the amount to simulate. Tell me how much you want to spend."
                )
            else:
                level = _decision_level(context.purchase_decision.decision)
                answer = (
                    f"{level}: dopo la spesa resterebbero {_format_money(context.purchase_decision.available_to_spend_after_purchase, currency)} di disponibilita' reale."
                    if _is_italian(locale)
                    else f"{level}: {_format_money(context.purchase_decision.available_to_spend_after_purchase, currency)} of real availability would remain after the purchase."
                )
        elif classification.intent == "budget_analysis":
            answer = (
                f"Non vedo limiti di budget per categoria documentati nel backend. La disponibilita' reale di oggi e' {_format_money(today.available_to_spend_today, currency)}."
                if _is_italian(locale)
                else f"I do not see documented category budget limits in the backend yet. Real availability today is {_format_money(today.available_to_spend_today, currency)}."
            )
        elif classification.intent == "goal_analysis":
            answer = (
                f"Hai {context.goal_state.goals_count} obiettivi. Il saldo protetto documentato e' {_format_money(context.goal_state.safety_buffer_reserved, currency)} e il contributo pianificato e' {_format_money(context.goal_state.planned_goal_contribution, currency)}."
                if _is_italian(locale)
                else f"You have {context.goal_state.goals_count} goals. Documented protected balance is {_format_money(context.goal_state.safety_buffer_reserved, currency)} and planned contribution is {_format_money(context.goal_state.planned_goal_contribution, currency)}."
            )
        elif classification.intent == "forecast_check":
            answer = (
                f"Con i dati documentati vedo {_format_money(today.available_to_spend_today, currency)} disponibili oggi, { _format_money(context.documented_income, currency) } di entrate imminenti e { _format_money(context.documented_outgoing, currency) } di uscite imminenti. Non vedo ancora una previsione di fine mese piu' completa nel backend."
                if _is_italian(locale)
                else f"With documented data I see {_format_money(today.available_to_spend_today, currency)} available today, {_format_money(context.documented_income, currency)} of upcoming income, and {_format_money(context.documented_outgoing, currency)} of upcoming outgoing items. I do not yet see a fuller month-end forecast in the backend."
            )
        elif classification.intent == "survival_plan":
            answer = (
                f"Piano prudente: proteggi {_format_money(today.available_to_spend_today, currency)} di disponibilita' reale, evita nuove spese opzionali se la pressione aumenta, e ricontrolla {context.upcoming_items_count} movimenti documentati in arrivo."
                if _is_italian(locale)
                else f"Cautious plan: protect {_format_money(today.available_to_spend_today, currency)} of real availability, avoid new optional spending if pressure rises, and review {context.upcoming_items_count} documented upcoming items."
            )
        else:
            answer = (
                "Posso aiutarti su disponibilita' reale, acquisti, obiettivi e pianificazione prudente con i dati documentati."
                if _is_italian(locale)
                else "I can help with real availability, purchases, goals, and cautious planning using documented data."
            )

        return CopilotReplyRead(
            provider="mock",
            model_version=self.model_version,
            intent=classification.intent,
            answer=answer,
            classification=classification,
            context=context.safe_context,
        )


class OptionalLlmCopilotProvider:
    source = "openai"

    def generate_reply(self, context: CopilotProviderContext) -> CopilotReplyRead:
        raise RuntimeError("The optional Copilot LLM provider is disabled.")


@dataclass(frozen=True)
class CopilotProviders:
    default_provider_name: str
    llm_enabled: bool
    openai_api_key: str | None
    providers: dict[str, CopilotProvider]

    def resolve(self) -> CopilotProvider:
        provider_name = self.default_provider_name.strip().lower()

        if (
            provider_name == "openai"
            and self.llm_enabled
            and self.openai_api_key
            and self.providers.get("openai") is not None
        ):
            return self.providers["openai"]

        deterministic_provider = self.providers.get("mock")
        if deterministic_provider is None:
            raise RuntimeError("Deterministic copilot provider is not configured.")
        return deterministic_provider
