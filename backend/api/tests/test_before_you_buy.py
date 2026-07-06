from datetime import date

import pytest


@pytest.mark.anyio
async def test_before_you_buy_evaluates_purchase_against_core_decision_logic(
    client,
) -> None:
    await client.post(
        "/accounts",
        json={"name": "Cash", "balance": 1650, "currency": "EUR"},
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
    )

    response = await client.post(
        "/before-you-buy",
        json={
            "amount": 100,
            "currency": "EUR",
            "description": "Shoes",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_available_to_spend"] == 705
    assert payload["available_to_spend_after_purchase"] == 605
    assert payload["decision"] == "safe"
    assert payload["can_afford"] is True
    assert payload["confidence"]["purchase_context"] == "matched-currency"
