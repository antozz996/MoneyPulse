from datetime import date, timedelta

import pytest


@pytest.mark.anyio
async def test_recurring_events_support_crud(client, register_user) -> None:
    auth = await register_user()
    create_response = await client.post(
        "/recurring-events",
        json={
            "name": "Gym membership",
            "amount": 40,
            "currency": "EUR",
            "direction": "expense",
            "category": "committed",
            "cadence": "monthly",
            "start_date": date.today().isoformat(),
            "active": True,
        },
        headers=auth["headers"],
    )

    assert create_response.status_code == 201
    recurring_event_id = create_response.json()["id"]

    list_response = await client.get("/recurring-events", headers=auth["headers"])

    assert list_response.status_code == 200
    assert list_response.json()[0]["name"] == "Gym membership"

    update_response = await client.put(
        f"/recurring-events/{recurring_event_id}",
        json={
            "name": "Gym membership plus",
            "amount": 45,
            "currency": "EUR",
            "direction": "expense",
            "category": "committed",
            "cadence": "weekly",
            "start_date": (date.today() + timedelta(days=7)).isoformat(),
            "active": False,
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["cadence"] == "weekly"
    assert update_response.json()["active"] is False

    delete_response = await client.delete(
        f"/recurring-events/{recurring_event_id}",
        headers=auth["headers"],
    )

    assert delete_response.status_code == 204
    assert (await client.get("/recurring-events", headers=auth["headers"])).json() == []


@pytest.mark.anyio
async def test_recurring_events_validate_category_rules(client, register_user) -> None:
    auth = await register_user()
    response = await client.post(
        "/recurring-events",
        json={
            "name": "Broken event",
            "amount": 40,
            "currency": "EUR",
            "direction": "expense",
            "cadence": "weekly",
            "start_date": date.today().isoformat(),
            "active": True,
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
