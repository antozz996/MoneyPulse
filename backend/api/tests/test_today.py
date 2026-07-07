from datetime import date

import pytest


@pytest.mark.anyio
async def test_today_endpoint_aggregates_authenticated_user_financial_context(
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

    response = await client.get("/today", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["available_to_spend_today"] == 705
    assert payload["risk_level"] == "safe"
    assert payload["inputs"] == {
        "available_balance": 1650,
        "expected_income_today": 0,
        "essential_obligations": 420,
        "committed_spending": 75,
        "safety_buffer": 300,
        "planned_goal_contribution": 150,
    }
    assert payload["confidence"]["mode"] == "deterministic"


@pytest.mark.anyio
async def test_today_includes_matching_recurring_events(client, register_user) -> None:
    auth = await register_user()
    await client.post(
        "/accounts",
        json={"name": "Cash", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    await client.post(
        "/recurring-events",
        json={
            "name": "Subscription",
            "amount": 25,
            "currency": "EUR",
            "direction": "expense",
            "category": "committed",
            "cadence": "daily",
            "start_date": date.today().isoformat(),
            "active": True,
        },
        headers=auth["headers"],
    )
    await client.post(
        "/recurring-events",
        json={
            "name": "Allowance",
            "amount": 50,
            "currency": "EUR",
            "direction": "income",
            "cadence": "weekly",
            "start_date": date.today().isoformat(),
            "active": True,
        },
        headers=auth["headers"],
    )

    response = await client.get("/today", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["available_to_spend_today"] == 1025
    assert payload["inputs"]["expected_income_today"] == 50
    assert payload["inputs"]["committed_spending"] == 25
