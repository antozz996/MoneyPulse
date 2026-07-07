from datetime import date, timedelta

import pytest


@pytest.mark.anyio
async def test_recurring_events_support_crud(client) -> None:
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
    )

    assert create_response.status_code == 201
    recurring_event_id = create_response.json()["id"]

    list_response = await client.get("/recurring-events")

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
    )

    assert update_response.status_code == 200
    assert update_response.json()["cadence"] == "weekly"
    assert update_response.json()["active"] is False

    delete_response = await client.delete(f"/recurring-events/{recurring_event_id}")

    assert delete_response.status_code == 204
    assert (await client.get("/recurring-events")).json() == []


@pytest.mark.anyio
async def test_recurring_events_validate_category_rules(client) -> None:
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
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
