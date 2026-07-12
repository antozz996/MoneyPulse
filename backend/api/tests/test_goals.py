import pytest


@pytest.mark.anyio
async def test_goals_endpoints_create_and_list_goals(client, register_user) -> None:
    auth = await register_user()
    create_response = await client.post(
        "/goals",
        json={
            "name": "Emergency fund",
            "target_amount": 5000,
            "current_amount": 300,
            "monthly_contribution": 150,
            "currency": "EUR",
            "priority": "IMPORTANT",
        },
        headers=auth["headers"],
    )

    assert create_response.status_code == 201
    assert create_response.json()["priority"] == "IMPORTANT"

    buffer_response = await client.post(
        "/goals",
        json={
            "name": "Safety buffer",
            "target_amount": 300,
            "current_amount": 300,
            "monthly_contribution": 0,
            "currency": "EUR",
            "priority": "ESSENTIAL",
            "kind": "safety_buffer",
        },
        headers=auth["headers"],
    )

    assert buffer_response.status_code == 201

    list_response = await client.get("/goals", headers=auth["headers"])

    assert list_response.status_code == 200
    assert len(list_response.json()) == 2


@pytest.mark.anyio
async def test_goals_support_update_and_delete(client, register_user) -> None:
    auth = await register_user()
    create_response = await client.post(
        "/goals",
        json={
            "name": "Emergency fund",
            "target_amount": 5000,
            "current_amount": 100,
            "monthly_contribution": 150,
            "currency": "EUR",
            "priority": "IMPORTANT",
        },
        headers=auth["headers"],
    )
    goal_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/goals/{goal_id}",
        json={
            "name": "Updated emergency fund",
            "target_amount": 5500,
            "monthly_contribution": 180,
            "priority": "FLEXIBLE",
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated emergency fund"
    assert update_response.json()["target_amount"] == 5500
    assert update_response.json()["monthly_contribution"] == 180
    assert update_response.json()["priority"] == "FLEXIBLE"

    delete_response = await client.delete(f"/goals/{goal_id}", headers=auth["headers"])

    assert delete_response.status_code == 204
    assert (await client.get("/goals", headers=auth["headers"])).json() == []


@pytest.mark.anyio
async def test_goals_are_scoped_to_current_user(client, register_user) -> None:
    first_user = await register_user(email="goal-owner@example.com")
    second_user = await register_user(email="goal-stranger@example.com")
    create_response = await client.post(
        "/goals",
        json={
            "name": "Emergency fund",
            "target_amount": 5000,
            "current_amount": 0,
            "monthly_contribution": 200,
            "currency": "EUR",
            "priority": "IMPORTANT",
        },
        headers=first_user["headers"],
    )

    goal_id = create_response.json()["id"]
    response = await client.patch(
        f"/goals/{goal_id}",
        json={"current_amount": 400},
        headers=second_user["headers"],
    )
    delete_response = await client.delete(f"/goals/{goal_id}", headers=second_user["headers"])

    assert response.status_code == 404
    assert delete_response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.anyio
async def test_goals_reject_invalid_payloads_and_user_id_spoofing(client, register_user) -> None:
    auth = await register_user()
    response = await client.post(
        "/goals",
        json={
            "name": "",
            "target_amount": -1000,
            "current_amount": 100,
            "monthly_contribution": 100,
            "currency": "EU",
            "priority": "IMPORTANT",
            "user_id": "spoofed-user",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
