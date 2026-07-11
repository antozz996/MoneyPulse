from datetime import date

import httpx
import pytest

from app.main import create_app


@pytest.mark.anyio
async def test_before_you_buy_evaluates_purchase_against_core_decision_logic(
    client,
    register_user,
) -> None:
    auth = await register_user()
    await client.post(
        "/accounts",
        json={"name": "Cash", "balance": 1650, "currency": "EUR"},
        headers=auth["headers"],
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
        headers=auth["headers"],
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
        headers=auth["headers"],
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
        headers=auth["headers"],
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
        headers=auth["headers"],
    )

    response = await client.post(
        "/before-you-buy",
        json={
            "amount": 100,
            "currency": "EUR",
            "description": "Shoes",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_available_to_spend"] == 705
    assert payload["available_to_spend_after_purchase"] == 605
    assert payload["decision"] == "safe"
    assert payload["can_afford"] is True
    assert payload["confidence"]["purchase_context"] == "matched-currency"


@pytest.mark.anyio
async def test_before_you_buy_falls_back_when_core_cli_is_unavailable(
    settings_factory,
) -> None:
    settings = settings_factory(
        core_cli_command=("node", "/definitely-missing-decision-engine.mjs"),
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
                "name": "Fallback Buy User",
                "email": "fallback-buy@example.com",
                "password": "password123",
            },
        )
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

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

        response = await client.post(
            "/before-you-buy",
            json={
                "amount": 100,
                "currency": "EUR",
                "description": "Shoes",
            },
            headers=headers,
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_available_to_spend"] == 705
    assert payload["available_to_spend_after_purchase"] == 605
    assert payload["decision"] == "safe"
    assert payload["can_afford"] is True
