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


@pytest.mark.anyio
async def test_goals_support_update_and_delete(client) -> None:
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
    goal_id = create_response.json()["id"]

    update_response = await client.put(
        f"/goals/{goal_id}",
        json={
            "name": "Updated emergency fund",
            "target_amount": 5500,
            "planned_contribution": 180,
            "reserved_amount": 0,
            "currency": "EUR",
            "kind": "goal",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated emergency fund"
    assert update_response.json()["target_amount"] == 5500

    delete_response = await client.delete(f"/goals/{goal_id}")

    assert delete_response.status_code == 204
    assert (await client.get("/goals")).json() == []


@pytest.mark.anyio
async def test_goals_return_not_found_for_missing_record(client) -> None:
    response = await client.put(
        "/goals/999",
        json={
            "name": "Missing",
            "target_amount": 1000,
            "planned_contribution": 100,
            "reserved_amount": 0,
            "currency": "EUR",
            "kind": "goal",
        },
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
