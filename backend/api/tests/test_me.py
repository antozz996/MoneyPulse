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
    assert len(payload["accounts"]) == 1
    assert len(payload["transactions"]) == 1
    assert len(payload["goals"]) == 1
    assert payload["recurring_events"] == []
    assert payload["checkpoints"] == []
    assert payload["bank_connections"] == []
    assert "password_hash" not in str(payload)


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
