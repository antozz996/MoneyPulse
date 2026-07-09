from datetime import date

import httpx
import pytest

from app.main import create_app
from app.services.copilot_providers import CopilotProviders, DeterministicCopilotProvider


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
    assert payload["intent"] == "affordability_check"
    assert "EUR" in payload["answer"]


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
