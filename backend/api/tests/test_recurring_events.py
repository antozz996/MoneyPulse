from datetime import date, timedelta

import pytest


@pytest.mark.anyio
async def test_recurring_events_support_crud(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1200, "currency": "EUR"},
        headers=auth["headers"],
    )
    create_response = await client.post(
        "/recurring-items",
        json={
            "name": "Gym membership",
            "account_id": account_response.json()["id"],
            "amount": 40,
            "currency": "EUR",
            "type": "expense",
            "category": "committed",
            "frequency": "monthly",
            "next_due_date": date.today().isoformat(),
            "status": "active",
        },
        headers=auth["headers"],
    )

    assert create_response.status_code == 201
    recurring_event_id = create_response.json()["id"]

    list_response = await client.get("/recurring-items", headers=auth["headers"])

    assert list_response.status_code == 200
    assert list_response.json()[0]["name"] == "Gym membership"

    update_response = await client.patch(
        f"/recurring-items/{recurring_event_id}",
        json={
            "name": "Gym membership plus",
            "amount": 45,
            "frequency": "weekly",
            "next_due_date": (date.today() + timedelta(days=7)).isoformat(),
            "status": "paused",
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["frequency"] == "weekly"
    assert update_response.json()["active"] is False

    delete_response = await client.delete(
        f"/recurring-items/{recurring_event_id}",
        headers=auth["headers"],
    )

    assert delete_response.status_code == 204
    assert (await client.get("/recurring-items", headers=auth["headers"])).json() == []


@pytest.mark.anyio
async def test_recurring_items_are_scoped_to_current_user(client, register_user) -> None:
    first_user = await register_user(email="recurring-owner@example.com")
    second_user = await register_user(email="recurring-stranger@example.com")
    create_response = await client.post(
        "/recurring-items",
        json={
            "name": "Salary",
            "amount": 1200,
            "currency": "EUR",
            "type": "income",
            "frequency": "monthly",
            "next_due_date": date.today().isoformat(),
            "status": "active",
        },
        headers=first_user["headers"],
    )

    recurring_event_id = create_response.json()["id"]
    update_response = await client.patch(
        f"/recurring-items/{recurring_event_id}",
        json={"amount": 1300},
        headers=second_user["headers"],
    )
    delete_response = await client.delete(
        f"/recurring-items/{recurring_event_id}",
        headers=second_user["headers"],
    )

    assert update_response.status_code == 404
    assert delete_response.status_code == 404


@pytest.mark.anyio
async def test_recurring_events_validate_payload_rules(client, register_user) -> None:
    auth = await register_user()
    response = await client.post(
        "/recurring-items",
        json={
            "name": "Broken event",
            "amount": 40,
            "currency": "EU",
            "type": "expense",
            "frequency": "weekly",
            "next_due_date": date.today().isoformat(),
            "user_id": "spoofed-user",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
