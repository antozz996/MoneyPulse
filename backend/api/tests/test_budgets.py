import pytest


@pytest.mark.anyio
async def test_budgets_support_create_list_update_and_delete(client, register_user) -> None:
    auth = await register_user()
    categories_response = await client.get("/categories", headers=auth["headers"])
    housing_category_id = next(
        category["id"]
        for category in categories_response.json()
        if category["key"] == "housing"
    )

    create_response = await client.post(
        "/budgets",
        json={
            "category_id": housing_category_id,
            "amount": 900,
            "currency": "EUR",
            "period": "MONTHLY",
        },
        headers=auth["headers"],
    )

    assert create_response.status_code == 201
    budget_id = create_response.json()["id"]

    list_response = await client.get("/budgets", headers=auth["headers"])
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    update_response = await client.patch(
        f"/budgets/{budget_id}",
        json={"amount": 950},
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["amount"] == 950

    delete_response = await client.delete(f"/budgets/{budget_id}", headers=auth["headers"])
    assert delete_response.status_code == 204
    assert (await client.get("/budgets", headers=auth["headers"])).json() == []


@pytest.mark.anyio
async def test_budgets_are_scoped_to_current_user(client, register_user) -> None:
    first_user = await register_user(email="budget-owner@example.com")
    second_user = await register_user(email="budget-stranger@example.com")
    categories_response = await client.get("/categories", headers=first_user["headers"])
    housing_category_id = next(
        category["id"]
        for category in categories_response.json()
        if category["key"] == "housing"
    )

    create_response = await client.post(
        "/budgets",
        json={
            "category_id": housing_category_id,
            "amount": 750,
            "currency": "EUR",
            "period": "SALARY_CYCLE",
        },
        headers=first_user["headers"],
    )

    budget_id = create_response.json()["id"]
    update_response = await client.patch(
        f"/budgets/{budget_id}",
        json={"amount": 800},
        headers=second_user["headers"],
    )
    delete_response = await client.delete(
        f"/budgets/{budget_id}",
        headers=second_user["headers"],
    )

    assert update_response.status_code == 404
    assert delete_response.status_code == 404


@pytest.mark.anyio
async def test_budgets_reject_invalid_payloads(client, register_user) -> None:
    auth = await register_user()
    categories_response = await client.get("/categories", headers=auth["headers"])
    salary_category_id = next(
        category["id"]
        for category in categories_response.json()
        if category["key"] == "salary"
    )

    response = await client.post(
        "/budgets",
        json={
            "category_id": salary_category_id,
            "amount": -1,
            "currency": "EU",
            "period": "MONTHLY",
            "user_id": "spoofed-user",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
