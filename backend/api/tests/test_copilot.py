from datetime import date

import httpx
import pytest

from app.main import create_app
from app.services.copilot_providers import (
    CopilotClassificationRead,
    CopilotEntitiesRead,
    CopilotGoalState,
    CopilotProviderContext,
    CopilotProviders,
    DeterministicCopilotProvider,
    OpenAiCopilotProvider,
)
from app.schemas.copilot import (
    CopilotBudgetSummaryRead,
    CopilotChatCreate,
    CopilotContextRead,
    CopilotGoalSummaryRead,
    CopilotMoneyAmountRead,
    CopilotSnapshotSummaryRead,
)
from app.schemas.decisioning import TodayRead


async def _seed_financial_context(client: httpx.AsyncClient, headers: dict[str, str]) -> None:
    await client.post(
        "/accounts",
        json={"name": "Cash", "balance": 1650, "currency": "EUR"},
        headers=headers,
    )
    await client.post(
        "/transactions",
        json={
            "name": "Rent",
            "amount": 420,
            "currency": "EUR",
            "direction": "expense",
            "category": "essential",
            "effective_date": date.today().isoformat(),
        },
        headers=headers,
    )
    await client.post(
        "/transactions",
        json={
            "name": "Groceries",
            "amount": 75,
            "currency": "EUR",
            "direction": "expense",
            "category": "committed",
            "effective_date": date.today().isoformat(),
        },
        headers=headers,
    )
    await client.post(
        "/goals",
        json={
            "name": "Safety buffer",
            "target_amount": 300,
            "planned_contribution": 0,
            "reserved_amount": 300,
            "currency": "EUR",
            "kind": "safety_buffer",
        },
        headers=headers,
    )
    await client.post(
        "/goals",
        json={
            "name": "Holiday fund",
            "target_amount": 2000,
            "planned_contribution": 150,
            "reserved_amount": 0,
            "currency": "EUR",
            "kind": "goal",
        },
        headers=headers,
    )


@pytest.mark.anyio
async def test_copilot_route_rejects_invalid_request(client, register_user) -> None:
    auth = await register_user()

    response = await client.post(
        "/api/copilot/chat",
        json={
            "message": "Come sto andando?",
            "locale": "it-IT",
            "history": [{"role": "system", "text": "nope"}],
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.anyio
async def test_copilot_route_requires_authentication_in_app_mode(client) -> None:
    response = await client.post(
        "/api/copilot/chat",
        json={
            "message": "Come sto andando?",
            "locale": "it-IT",
            "history": [],
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.anyio
async def test_copilot_route_rejects_oversized_message(client, register_user) -> None:
    auth = await register_user()

    response = await client.post(
        "/api/copilot/chat",
        json={
            "message": "x" * 501,
            "locale": "it-IT",
            "history": [],
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_copilot_providers_fall_back_to_mock_when_llm_is_disabled() -> None:
    providers = CopilotProviders(
        default_provider_name="openai",
        llm_enabled=False,
        openai_api_key=None,
        openai_model="gpt-5.2",
        providers={"mock": DeterministicCopilotProvider()},
    )

    assert providers.resolve().source == "mock"


@pytest.mark.anyio
async def test_copilot_route_returns_mock_fallback_when_live_ai_disabled(
    settings_factory,
) -> None:
    settings = settings_factory(
        copilot_provider="openai",
        copilot_llm_enabled=False,
        copilot_openai_api_key=None,
    )
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        register_response = await client.post(
            "/auth/register",
            json={
                "name": "Copilot User",
                "email": "copilot-disabled@example.com",
                "password": "password123",
            },
        )
        session = register_response.json()
        headers = {"Authorization": f"Bearer {session['access_token']}"}
        await _seed_financial_context(client, headers)

        response = await client.post(
            "/api/copilot/chat",
            json={
                "message": "Posso spendere 120 euro questo weekend?",
                "locale": "it-IT",
                "history": [],
            },
            headers=headers,
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "mock"
    assert payload["fallback_used"] is True
    assert payload["model"] == "gpt-5.2"
    assert payload["intent"] == "affordability_check"
    assert "EUR" in payload["answer"]


@pytest.mark.anyio
async def test_copilot_route_returns_mock_fallback_when_api_key_is_missing(
    settings_factory,
) -> None:
    settings = settings_factory(
        copilot_provider="openai",
        copilot_llm_enabled=True,
        copilot_openai_api_key=None,
        copilot_openai_model="gpt-5.2",
    )
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        register_response = await client.post(
            "/auth/register",
            json={
                "name": "Copilot Missing Key",
                "email": "copilot-missing-key@example.com",
                "password": "password123",
            },
        )
        session = register_response.json()
        headers = {"Authorization": f"Bearer {session['access_token']}"}
        await _seed_financial_context(client, headers)

        response = await client.post(
            "/api/copilot/chat",
            json={
                "message": "Come sto andando?",
                "locale": "it-IT",
                "history": [],
            },
            headers=headers,
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "mock"
    assert payload["fallback_used"] is True
    assert payload["model"] == "gpt-5.2"


@pytest.mark.anyio
async def test_copilot_route_does_not_require_api_key_by_default(
    client,
    register_user,
) -> None:
    auth = await register_user()
    await _seed_financial_context(client, auth["headers"])

    response = await client.post(
        "/api/copilot/chat",
        json={
            "message": "Come sto andando?",
            "locale": "it-IT",
            "history": [],
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "mock"
    assert payload["context"]["currency"] == "EUR"
    assert payload["fallback_used"] is False


def _build_provider_context() -> CopilotProviderContext:
    today = TodayRead(
        available_to_spend_today=705,
        risk_level="safe",
        currency="EUR",
        model_version="1.0.0",
        explanations=["example"],
        inputs={
            "available_balance": 1650,
            "expected_income_today": 0,
            "essential_obligations": 420,
            "committed_spending": 75,
            "safety_buffer": 300,
            "planned_goal_contribution": 150,
        },
        confidence={
            "mode": "deterministic",
            "input_completeness": "complete",
            "uses_documented_inputs_only": True,
            "purchase_context": "not-provided",
            "supported_inputs": [
                "availableBalance",
                "expectedIncomeToday",
                "essentialObligations",
                "committedSpending",
                "safetyBuffer",
                "plannedGoalContribution",
            ],
            "model_version": "1.0.0",
        },
    )

    return CopilotProviderContext(
        request=CopilotChatCreate(
            message="Come sto andando?",
            locale="it-IT",
            history=[{"role": "user", "text": "Sto cercando di spendere meglio."}],
        ),
        classification=CopilotClassificationRead(
            intent="health_check",
            confidence=0.84,
            entities=CopilotEntitiesRead(amount=None, currency=None),
        ),
        safe_context=CopilotContextRead(
            locale="it-IT",
            currency="EUR",
            risk_profile="BALANCED",
            snapshot_summary=CopilotSnapshotSummaryRead(
                cycle_start=date.today(),
                cycle_end=date.today(),
                real_availability_now=CopilotMoneyAmountRead(amount=705, currency="EUR"),
                projected_availability=CopilotMoneyAmountRead(amount=705, currency="EUR"),
                safe_daily_spend=CopilotMoneyAmountRead(amount=705, currency="EUR"),
                decision_level="GREEN",
            ),
            budget_summary=CopilotBudgetSummaryRead(
                overall="HEALTHY",
                over_limit_categories=[],
                near_limit_categories=[],
            ),
            goal_summary=CopilotGoalSummaryRead(
                essential_covered=True,
                important_covered=True,
                flexible_deferred=True,
                remaining_this_cycle=CopilotMoneyAmountRead(amount=150, currency="EUR"),
            ),
            recent_decision_summary=None,
        ),
        today=today,
        goal_state=CopilotGoalState(
            goals_count=2,
            safety_buffer_reserved=300,
            planned_goal_contribution=150,
        ),
        upcoming_items_count=3,
        documented_income=0,
        documented_outgoing=495,
        purchase_decision=None,
    )


def test_openai_provider_payload_excludes_secrets_and_raw_transactions() -> None:
    provider = OpenAiCopilotProvider(
        api_key="super-secret-key",
        model="gpt-5.2",
        timeout_seconds=15,
        fallback_provider=DeterministicCopilotProvider(),
    )

    payload = provider.build_request_payload(_build_provider_context())
    serialized = str(payload)

    assert "super-secret-key" not in serialized
    assert "OPENAI_API_KEY" not in serialized
    assert "Rent" not in serialized
    assert "Groceries" not in serialized
    assert "grounding_rules" in serialized
    assert "response_contract" in serialized
    assert "engine_outputs" in serialized
    assert "cite_engine_fields_internally" in serialized


def test_openai_provider_timeout_uses_mock_fallback() -> None:
    provider = OpenAiCopilotProvider(
        api_key="test-key",
        model="gpt-5.2",
        timeout_seconds=15,
        fallback_provider=DeterministicCopilotProvider(),
        request_executor=lambda *_args, **_kwargs: (_ for _ in ()).throw(TimeoutError("timeout")),
    )

    reply = provider.generate_reply(_build_provider_context())

    assert reply.provider == "mock"
    assert reply.fallback_used is True
    assert reply.model == "gpt-5.2"
    assert reply.intent == "health_check"


def test_openai_provider_success_keeps_reply_shape_stable() -> None:
    provider = OpenAiCopilotProvider(
        api_key="test-key",
        model="gpt-5.2",
        timeout_seconds=15,
        fallback_provider=DeterministicCopilotProvider(),
        request_executor=lambda *_args, **_kwargs: {
            "model": "gpt-5.2",
            "output_text": "Real availability today is 705.00 EUR after documented obligations, buffer, and goals.",
        },
    )

    reply = provider.generate_reply(_build_provider_context())

    assert reply.provider == "openai"
    assert reply.fallback_used is False
    assert reply.model == "gpt-5.2"
    assert reply.answer.startswith("Real availability today is 705.00 EUR")
    assert reply.context.currency == "EUR"
