import pytest


@pytest.mark.anyio
async def test_goals_endpoints_create_and_list_goals(client) -> None:
    create_response = await client.post(
        "/goals",
        json={
            "name": "Emergency fund",
            "target_amount": 5000,
            "planned_contribution": 150,
            "reserved_amount": 0,
            "currency": "EUR",
            "kind": "goal",
        },
    )

    assert create_response.status_code == 201
    assert create_response.json()["kind"] == "goal"

    buffer_response = await client.post(
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

    assert buffer_response.status_code == 201

    list_response = await client.get("/goals")

    assert list_response.status_code == 200
    assert len(list_response.json()) == 2
