from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import json
import re
from socket import timeout as socket_timeout
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Protocol

from app.schemas.copilot import (
    CopilotChatCreate,
    CopilotClassificationRead,
    CopilotContextRead,
    CopilotEntitiesRead,
    CopilotReplyRead,
)
from app.schemas.decisioning import BeforeYouBuyRead, TodayRead

MONEY_PULSE_COPILOT_SYSTEM_PROMPT = """
You are Money Pulse Copilot, a practical personal finance assistant.
You must never invent numbers.
If a response includes financial numbers, they must come from engine or tool outputs.
Do not recalculate financial values independently when structured engine outputs are provided.
Ground the answer explicitly on the provided engine fields and internal summaries.
You are not a regulated financial advisor.
You help with budgeting, spending decisions, cashflow and personal planning.
You distinguish between account balance and real availability.
Protected balance is a hard constraint.
Use GREEN, YELLOW, RED, BLACK decisions when relevant.
Tone: direct, practical, human, non-moralistic.
If data is missing, say what is missing and give a cautious answer.
When relevant, structure the answer as: direct answer, key numbers, why, risk level, next action.
""".strip()


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


OpenAiRequestExecutor = Callable[[dict[str, Any], str, float], dict[str, Any]]


def _decision_level(decision: str) -> str:
    if decision == "safe":
        return "GREEN"
    if decision == "caution":
        return "YELLOW"
    return "RED"


def _level_tone(locale: str, level: str) -> str:
    if _is_italian(locale):
        return {
            "GREEN": "verde",
            "YELLOW": "giallo",
            "RED": "rosso",
            "BLACK": "nero",
        }.get(level, level.lower())

    return level.lower()


def _risk_sentence(locale: str, level: str) -> str:
    if _is_italian(locale):
        return f"Semaforo {_level_tone(locale, level)} ({level})."
    return f"Risk level: {_level_tone(locale, level)} ({level})."


def _join_parts(*parts: str | None) -> str:
    return " ".join(part for part in parts if part and part.strip())


def _missing_data_notes(context: CopilotProviderContext) -> list[str]:
    notes: list[str] = []
    if context.goal_state.safety_buffer_reserved <= 0:
        notes.append(
            "Manca un saldo protetto documentato."
            if _is_italian(context.request.locale)
            else "Protected balance is not documented yet."
        )
    if context.goal_state.goals_count <= 0:
        notes.append(
            "Non vedo obiettivi configurati."
            if _is_italian(context.request.locale)
            else "I do not see any goals configured."
        )
    if context.documented_income == 0 and context.documented_outgoing == 0:
        notes.append(
            "Non vedo ancora movimenti imminenti documentati."
            if _is_italian(context.request.locale)
            else "I do not yet see documented upcoming transactions."
        )
    return notes


def _warnings_sentence(locale: str, warnings: list[str]) -> str | None:
    if not warnings:
        return None
    prefix = "Dati mancanti:" if _is_italian(locale) else "Missing data:"
    return f"{prefix} {' '.join(warnings)}"


class DeterministicCopilotProvider:
    source = "mock"
    model_version = "deterministic-mock-v1"

    def generate_reply(self, context: CopilotProviderContext) -> CopilotReplyRead:
        locale = context.request.locale
        currency = context.today.currency
        classification = context.classification
        today = context.today
        warnings = _missing_data_notes(context)

        if classification.intent == "health_check":
            level = _decision_level(today.risk_level)
            answer = _join_parts(
                (
                    "Stai andando bene."
                    if _is_italian(locale) and level == "GREEN"
                    else "Stai andando bene, ma con meno margine."
                    if _is_italian(locale) and level == "YELLOW"
                    else "Sei sotto pressione in questo ciclo."
                    if _is_italian(locale)
                    else "You are on track."
                    if level == "GREEN"
                    else "You are okay, but with less margin."
                    if level == "YELLOW"
                    else "This cycle is under pressure."
                ),
                (
                    f"Disponibilita' reale: {_format_money(today.available_to_spend_today, currency)}."
                    if _is_italian(locale)
                    else f"Real availability: {_format_money(today.available_to_spend_today, currency)}."
                ),
                _risk_sentence(locale, level),
                (
                    "Uso solo saldo disponibile, obblighi documentati, buffer e obiettivi pianificati."
                    if _is_italian(locale)
                    else "I am using only available balance, documented obligations, buffer, and planned goals."
                ),
                _warnings_sentence(locale, warnings),
                (
                    "Ricontrolla prima del prossimo acquisto importante."
                    if _is_italian(locale)
                    else "Recheck before the next meaningful purchase."
                ),
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
                answer = _join_parts(
                    (
                        "Puoi farlo."
                        if _is_italian(locale) and level == "GREEN"
                        else "Puoi farlo, ma con cautela."
                        if _is_italian(locale) and level == "YELLOW"
                        else "Non lo consiglierei."
                        if _is_italian(locale)
                        else "You can do it."
                        if level == "GREEN"
                        else "You can do it, but be careful."
                        if level == "YELLOW"
                        else "I would not recommend it."
                    ),
                    (
                        f"Disponibilita' reale: da {_format_money(context.purchase_decision.current_available_to_spend, currency)} a {_format_money(context.purchase_decision.available_to_spend_after_purchase, currency)}."
                        if _is_italian(locale)
                        else f"Real availability: from {_format_money(context.purchase_decision.current_available_to_spend, currency)} to {_format_money(context.purchase_decision.available_to_spend_after_purchase, currency)}."
                    ),
                    _risk_sentence(locale, level),
                    (
                        "Non sto ricalcolando numeri: uso solo i campi strutturati della simulazione."
                        if _is_italian(locale)
                        else "I am not recalculating numbers: I am using only the structured simulation fields."
                    ),
                    _warnings_sentence(locale, warnings),
                    (
                        "Bloccherei gli extra del weekend prima di aggiungere altra pressione."
                        if _is_italian(locale) and level in {"YELLOW", "RED"}
                        else "Restore margin first before adding more pressure."
                        if level in {"YELLOW", "RED"}
                        else "Procederei e terrei d'occhio il margine residuo."
                        if _is_italian(locale)
                        else "I would proceed and keep an eye on the remaining margin."
                    ),
                )
        elif classification.intent == "budget_analysis":
            answer = _join_parts(
                (
                    f"Non vedo limiti di budget per categoria documentati nel backend. Disponibilita' reale oggi: {_format_money(today.available_to_spend_today, currency)}."
                    if _is_italian(locale)
                    else f"I do not see documented category budget limits in the backend yet. Real availability today: {_format_money(today.available_to_spend_today, currency)}."
                ),
                _warnings_sentence(
                    locale,
                    warnings
                    + [
                        (
                            "Il backend non espone ancora budget per categoria."
                            if _is_italian(locale)
                            else "The backend does not expose category budgets yet."
                        )
                    ],
                ),
                (
                    "Per una risposta piu' precisa mi servono budget per categoria."
                    if _is_italian(locale)
                    else "For a sharper answer I need category budgets."
                ),
            )
        elif classification.intent == "goal_analysis":
            level = context.safe_context.snapshot_summary.decision_level
            answer = _join_parts(
                (
                    f"Hai {context.goal_state.goals_count} obiettivi."
                    if _is_italian(locale)
                    else f"You have {context.goal_state.goals_count} goals."
                ),
                (
                    f"Saldo protetto documentato: {_format_money(context.goal_state.safety_buffer_reserved, currency)}. Contributo pianificato: {_format_money(context.goal_state.planned_goal_contribution, currency)}."
                    if _is_italian(locale)
                    else f"Documented protected balance: {_format_money(context.goal_state.safety_buffer_reserved, currency)}. Planned contribution: {_format_money(context.goal_state.planned_goal_contribution, currency)}."
                ),
                _risk_sentence(locale, level),
                _warnings_sentence(locale, warnings),
                (
                    "Proteggerei prima buffer e contributi importanti."
                    if _is_italian(locale)
                    else "I would protect buffer and important contributions first."
                ),
            )
        elif classification.intent == "forecast_check":
            level = context.safe_context.snapshot_summary.decision_level
            answer = _join_parts(
                (
                    f"Oggi vedo {_format_money(today.available_to_spend_today, currency)} disponibili, {_format_money(context.documented_income, currency)} di entrate imminenti e {_format_money(context.documented_outgoing, currency)} di uscite imminenti."
                    if _is_italian(locale)
                    else f"Today I see {_format_money(today.available_to_spend_today, currency)} available, {_format_money(context.documented_income, currency)} of upcoming income, and {_format_money(context.documented_outgoing, currency)} of upcoming outgoing items."
                ),
                _risk_sentence(locale, level),
                (
                    "Questa e' una previsione prudente basata solo sui movimenti documentati."
                    if _is_italian(locale)
                    else "This is a cautious forecast based only on documented items."
                ),
                _warnings_sentence(locale, warnings),
                (
                    "Ricontrollerei il quadro quando entrano nuove uscite o entrate."
                    if _is_italian(locale)
                    else "I would refresh the picture when new income or expenses land."
                ),
            )
        elif classification.intent == "survival_plan":
            level = context.safe_context.snapshot_summary.decision_level
            answer = _join_parts(
                (
                    f"Piano prudente: proteggi {_format_money(today.available_to_spend_today, currency)} di disponibilita' reale."
                    if _is_italian(locale)
                    else f"Cautious plan: protect {_format_money(today.available_to_spend_today, currency)} of real availability."
                ),
                (
                    f"Movimenti documentati in arrivo: {context.upcoming_items_count}. Entrate: {_format_money(context.documented_income, currency)}. Uscite: {_format_money(context.documented_outgoing, currency)}."
                    if _is_italian(locale)
                    else f"Documented upcoming items: {context.upcoming_items_count}. Income: {_format_money(context.documented_income, currency)}. Outgoing: {_format_money(context.documented_outgoing, currency)}."
                ),
                _risk_sentence(locale, level),
                _warnings_sentence(locale, warnings),
                (
                    "Io eviterei nuove spese opzionali finche' il margine non migliora."
                    if _is_italian(locale)
                    else "I would avoid new optional spending until the margin improves."
                ),
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
            fallback_used=False,
            model=None,
            intent=classification.intent,
            answer=answer,
            classification=classification,
            context=context.safe_context,
        )


def _augment_reply(
    reply: CopilotReplyRead,
    *,
    fallback_used: bool,
    model: str | None,
) -> CopilotReplyRead:
    return reply.model_copy(
        update={
            "fallback_used": fallback_used,
            "model": model,
        }
    )


def _extract_output_text(payload: dict[str, Any]) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()

    raise RuntimeError("OpenAI response did not include any text output.")


def _default_openai_request_executor(
    payload: dict[str, Any],
    api_key: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(body or str(exc)) from exc
    except (URLError, TimeoutError, socket_timeout) as exc:
        raise RuntimeError(str(exc)) from exc

    return json.loads(raw)


@dataclass(frozen=True)
class OpenAiCopilotProvider:
    source = "openai"
    api_key: str
    model: str
    timeout_seconds: float
    fallback_provider: CopilotProvider
    request_executor: OpenAiRequestExecutor = _default_openai_request_executor

    def build_request_payload(self, context: CopilotProviderContext) -> dict[str, Any]:
        warnings = _missing_data_notes(context)
        structured_context = {
            "grounding_rules": {
                "numbers_must_come_from": [
                    "safe_context.snapshot_summary",
                    "safe_context.recent_decision_summary",
                    "today_engine_output",
                    "purchase_engine_output",
                    "weekly_window_summary",
                    "goal_state",
                ],
                "do_not_recalculate": True,
                "protected_balance_hard_constraint": True,
                "cite_engine_fields_internally": True,
            },
            "response_contract": [
                "direct_answer",
                "key_numbers",
                "why",
                "risk_level",
                "next_action",
            ],
            "user_request": {
                "question": context.request.message,
                "locale": context.request.locale,
                "history": [
                    item.model_dump(mode="json") for item in context.request.history[-12:]
                ],
                "classification": context.classification.model_dump(mode="json"),
            },
            "engine_outputs": {
                "safe_context": context.safe_context.model_dump(mode="json"),
                "today_engine_output": context.today.model_dump(mode="json"),
                "purchase_engine_output": (
                    context.purchase_decision.model_dump(mode="json")
                    if context.purchase_decision is not None
                    else None
                ),
                "goal_state": {
                    "goals_count": context.goal_state.goals_count,
                    "safety_buffer_reserved": context.goal_state.safety_buffer_reserved,
                    "planned_goal_contribution": context.goal_state.planned_goal_contribution,
                },
                "weekly_window_summary": {
                    "documented_income": context.documented_income,
                    "documented_outgoing": context.documented_outgoing,
                    "upcoming_items_count": context.upcoming_items_count,
                },
            },
            "missing_data_warnings": warnings,
            "context_limitations": [
                "Do not assume category budgets unless they are explicitly present in safe_context.",
                "Do not infer undisclosed salary days, hidden balances, or raw transaction details.",
                "Use only these structured outputs; no raw transaction list is provided on purpose.",
            ],
        }

        prompt = (
            "Use only the structured MoneyPulse context below. "
            "Do not recalculate financial numbers independently. "
            "Internally reference the exact engine fields you are grounding on. "
            "If a number or a data point is missing, say it is missing and stay cautious.\n\n"
            f"{json.dumps(structured_context, ensure_ascii=False)}"
        )

        return {
            "model": self.model,
            "instructions": MONEY_PULSE_COPILOT_SYSTEM_PROMPT,
            "input": [
                {
                    "role": "developer",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                "Explain the existing engine outputs clearly. "
                                "Never invent financial numbers. "
                                "Protected balance is a hard constraint."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": prompt,
                        }
                    ],
                },
            ],
            "max_output_tokens": 220,
        }

    def generate_reply(self, context: CopilotProviderContext) -> CopilotReplyRead:
        try:
            payload = self.build_request_payload(context)
            response = self.request_executor(
                payload,
                self.api_key,
                self.timeout_seconds,
            )
            answer = _extract_output_text(response)
        except Exception:
            return _augment_reply(
                self.fallback_provider.generate_reply(context),
                fallback_used=True,
                model=self.model,
            )

        model = response.get("model")
        resolved_model = model if isinstance(model, str) and model.strip() else self.model

        return CopilotReplyRead(
            provider="openai",
            model_version=resolved_model,
            fallback_used=False,
            model=resolved_model,
            intent=context.classification.intent,
            answer=answer,
            classification=context.classification,
            context=context.safe_context,
        )


@dataclass(frozen=True)
class CopilotProviders:
    default_provider_name: str
    llm_enabled: bool
    openai_api_key: str | None
    openai_model: str | None
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

    def generate_reply(self, context: CopilotProviderContext) -> CopilotReplyRead:
        provider_name = self.default_provider_name.strip().lower()
        deterministic_provider = self.providers.get("mock")
        if deterministic_provider is None:
            raise RuntimeError("Deterministic copilot provider is not configured.")

        if provider_name != "openai":
            return deterministic_provider.generate_reply(context)

        if not self.llm_enabled or not self.openai_api_key:
            return _augment_reply(
                deterministic_provider.generate_reply(context),
                fallback_used=True,
                model=self.openai_model,
            )

        openai_provider = self.providers.get("openai")
        if openai_provider is None:
            return _augment_reply(
                deterministic_provider.generate_reply(context),
                fallback_used=True,
                model=self.openai_model,
            )

        return openai_provider.generate_reply(context)
