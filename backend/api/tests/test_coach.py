from datetime import date, timedelta
import httpx
import pytest

from app.main import create_app
from app.services.coach_providers import CoachProviders, DeterministicCoachProvider


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
async def test_coach_today_summary_matches_today_engine_output(
    client,
    register_user,
) -> None:
    auth = await register_user()
    await _seed_financial_context(client, auth["headers"])

    today_response = await client.get("/today", headers=auth["headers"])
    coach_response = await client.get("/coach/today-summary", headers=auth["headers"])

    assert today_response.status_code == 200
    assert coach_response.status_code == 200

    today_payload = today_response.json()
    coach_payload = coach_response.json()

    assert coach_payload["source"] == "deterministic"
    assert coach_payload["risk_level"] == today_payload["risk_level"]
    assert (
        coach_payload["available_to_spend_today"]
        == today_payload["available_to_spend_today"]
    )
    assert coach_payload["currency"] == today_payload["currency"]
    assert coach_payload["model_version"] == today_payload["model_version"]
    assert len(coach_payload["why"]) > 0
    assert len(coach_payload["what_changed"]) > 0
    assert len(coach_payload["next_steps"]) > 0


@pytest.mark.anyio
async def test_coach_explain_decision_only_explains_engine_outputs(
    client,
    register_user,
) -> None:
    auth = await register_user()
    await _seed_financial_context(client, auth["headers"])

    payload = {"amount": 100, "currency": "EUR", "description": "Shoes"}

    today_response = await client.get("/today", headers=auth["headers"])
    before_response = await client.post(
        "/before-you-buy",
        json=payload,
        headers=auth["headers"],
    )
    coach_response = await client.post(
        "/coach/explain-decision",
        json=payload,
        headers=auth["headers"],
    )

    assert today_response.status_code == 200
    assert before_response.status_code == 200
    assert coach_response.status_code == 200

    today_payload = today_response.json()
    before_payload = before_response.json()
    coach_payload = coach_response.json()

    assert coach_payload["source"] == "deterministic"
    assert coach_payload["baseline_risk_level"] == today_payload["risk_level"]
    assert coach_payload["decision"] == before_payload["decision"]
    assert (
        coach_payload["current_available_to_spend"]
        == before_payload["current_available_to_spend"]
    )
    assert coach_payload["purchase_amount"] == before_payload["purchase_amount"]
    assert (
        coach_payload["available_to_spend_after_purchase"]
        == before_payload["available_to_spend_after_purchase"]
    )
    assert coach_payload["delta"] == before_payload["delta"]
    assert coach_payload["can_afford"] == before_payload["can_afford"]
    assert coach_payload["currency"] == before_payload["currency"]


@pytest.mark.anyio
async def test_coach_weekly_summary_uses_documented_upcoming_items(
    client,
    register_user,
) -> None:
    auth = await register_user()
    await _seed_financial_context(client, auth["headers"])

    future_date = (date.today() + timedelta(days=2)).isoformat()

    await client.post(
        "/transactions",
        json={
            "name": "Freelance",
            "amount": 200,
            "currency": "EUR",
            "direction": "income",
            "effective_date": future_date,
        },
        headers=auth["headers"],
    )
    await client.post(
        "/recurring-events",
        json={
            "name": "Gym",
            "amount": 35,
            "currency": "EUR",
            "direction": "expense",
            "category": "committed",
            "cadence": "weekly",
            "start_date": future_date,
            "active": True,
        },
        headers=auth["headers"],
    )

    response = await client.get("/coach/weekly-summary", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "deterministic"
    assert payload["period_start"] == date.today().isoformat()
    assert payload["period_end"] == (date.today() + timedelta(days=6)).isoformat()
    assert payload["documented_income"] == 200
    assert payload["documented_outgoing"] == 530
    assert payload["upcoming_items_count"] >= 3
    assert len(payload["why"]) > 0
    assert len(payload["next_steps"]) > 0


def test_coach_providers_fall_back_to_deterministic_when_llm_is_disabled() -> None:
    providers = CoachProviders(
        default_provider_name="llm",
        llm_enabled=False,
        providers={"deterministic": DeterministicCoachProvider()},
    )

    assert providers.resolve().source == "deterministic"


@pytest.mark.anyio
async def test_coach_endpoints_use_deterministic_fallback_when_llm_is_disabled(
    settings_factory,
) -> None:
    settings = settings_factory(
        coach_provider="llm",
        coach_llm_enabled=False,
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
                "name": "Coach User",
                "email": "coach-disabled@example.com",
                "password": "password123",
            },
        )
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        await _seed_financial_context(client, headers)
        response = await client.get("/coach/today-summary", headers=headers)

    assert response.status_code == 200
    assert response.json()["source"] == "deterministic"
