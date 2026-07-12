from datetime import date

import pytest


@pytest.mark.anyio
async def test_user_export_returns_privacy_first_data_snapshot(
    client,
    register_user,
) -> None:
    auth = await register_user()

    await client.post(
        "/accounts",
        json={"name": "Main", "balance": 900, "currency": "EUR"},
        headers=auth["headers"],
    )
    await client.post(
        "/transactions",
        json={
            "name": "Rent",
            "amount": 300,
            "currency": "EUR",
            "direction": "expense",
            "category": "essential",
            "effective_date": date.today().isoformat(),
        },
        headers=auth["headers"],
    )
    await client.post(
        "/goals",
        json={
            "name": "Buffer",
            "target_amount": 500,
            "planned_contribution": 20,
            "reserved_amount": 50,
            "currency": "EUR",
            "kind": "safety_buffer",
        },
        headers=auth["headers"],
    )

    response = await client.get("/me/export", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == auth["credentials"]["email"]
    assert payload["financial_profile"] is None
    assert payload["categories"] == []
    assert payload["budgets"] == []
    assert len(payload["accounts"]) == 1
    assert len(payload["transactions"]) == 1
    assert len(payload["goals"]) == 1
    assert payload["recurring_events"] == []
    assert payload["checkpoints"] == []
    assert payload["bank_connections"] == []
    assert "password_hash" not in str(payload)


@pytest.mark.anyio
async def test_user_export_includes_recurring_events_and_bank_connections(
    client,
    register_user,
) -> None:
    auth = await register_user()

    await client.post(
        "/recurring-events",
        json={
            "name": "Gym",
            "amount": 45,
            "currency": "EUR",
            "direction": "expense",
            "category": "committed",
            "cadence": "monthly",
            "start_date": date.today().isoformat(),
            "active": True,
        },
        headers=auth["headers"],
    )

    started = await client.post(
        "/bank/connect/start",
        json={"provider": "mock"},
        headers=auth["headers"],
    )
    connection_id = started.json()["connection_id"]

    await client.post(
        "/bank/connect/complete",
        json={"connection_id": connection_id},
        headers=auth["headers"],
    )
    await client.post(
        "/bank/sync",
        json={"connection_id": connection_id},
        headers=auth["headers"],
    )

    response = await client.get("/me/export", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert "financial_profile" in payload
    assert "categories" in payload
    assert "budgets" in payload
    assert len(payload["recurring_events"]) == 1
    assert payload["recurring_events"][0]["name"] == "Gym"
    assert len(payload["bank_connections"]) == 1
    assert payload["bank_connections"][0]["institution_name"] == "Mock Bank Sandbox"
    assert payload["bank_connections"][0]["linked_accounts"] == 2


@pytest.mark.anyio
async def test_user_deletion_removes_user_data_and_invalidates_future_access(
    client,
    register_user,
) -> None:
    auth = await register_user()

    await client.post(
        "/accounts",
        json={"name": "Private", "balance": 500, "currency": "EUR"},
        headers=auth["headers"],
    )

    delete_response = await client.delete("/me", headers=auth["headers"])
    list_response = await client.get("/accounts", headers=auth["headers"])
    export_response = await client.get("/me/export", headers=auth["headers"])

    assert delete_response.status_code == 204
    assert list_response.status_code == 401
    assert export_response.status_code == 401
    assert list_response.json()["error"]["code"] == "authentication_error"
