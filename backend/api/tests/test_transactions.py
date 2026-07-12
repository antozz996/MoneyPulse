from datetime import date, timedelta

import pytest


@pytest.mark.anyio
async def test_transactions_create_uses_authenticated_user_scope(client, register_user) -> None:
    auth = await register_user()

    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1500, "currency": "EUR"},
        headers=auth["headers"],
    )
    category_response = await client.get("/categories", headers=auth["headers"])
    account_id = account_response.json()["id"]
    category_id = next(
        category["id"]
        for category in category_response.json()
        if category["key"] == "housing"
    )

    create_response = await client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "category_id": category_id,
            "amount": 400,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Rent",
            "merchant": "Landlord",
            "user_id": "spoofed-user",
        },
        headers=auth["headers"],
    )

    assert create_response.status_code == 422
    assert create_response.json()["error"]["code"] == "validation_error"

    valid_response = await client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "category_id": category_id,
            "amount": 400,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Rent",
            "merchant": "Landlord",
        },
        headers=auth["headers"],
    )

    assert valid_response.status_code == 201
    payload = valid_response.json()
    assert payload["account_id"] == account_id
    assert payload["category_id"] == category_id
    assert payload["type"] == "expense"
    assert payload["description"] == "Rent"
    assert payload["merchant"] == "Landlord"
    assert payload["source"] == "manual"
    assert payload["status"] == "posted"


@pytest.mark.anyio
async def test_transactions_list_returns_only_current_user_records(client, register_user) -> None:
    first_user = await register_user(email="first-transactions@example.com")
    second_user = await register_user(email="second-transactions@example.com")

    first_account = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1200, "currency": "EUR"},
        headers=first_user["headers"],
    )
    second_account = await client.post(
        "/accounts",
        json={"name": "Other", "balance": 900, "currency": "EUR"},
        headers=second_user["headers"],
    )

    await client.post(
        "/transactions",
        json={
            "account_id": first_account.json()["id"],
            "amount": 1200,
            "currency": "EUR",
            "type": "income",
            "date": date.today().isoformat(),
            "description": "Salary",
        },
        headers=first_user["headers"],
    )
    await client.post(
        "/transactions",
        json={
            "account_id": second_account.json()["id"],
            "amount": 50,
            "currency": "EUR",
            "type": "income",
            "date": date.today().isoformat(),
            "description": "Gift",
        },
        headers=second_user["headers"],
    )

    list_response = await client.get("/transactions", headers=first_user["headers"])

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["description"] == "Salary"


@pytest.mark.anyio
async def test_transactions_support_filters(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    account_id = account_response.json()["id"]

    await client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 1200,
            "currency": "EUR",
            "type": "income",
            "date": date.today().isoformat(),
            "description": "Salary",
        },
        headers=auth["headers"],
    )
    await client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 40,
            "currency": "EUR",
            "type": "expense",
            "date": (date.today() + timedelta(days=3)).isoformat(),
            "description": "Taxi",
        },
        headers=auth["headers"],
    )

    list_response = await client.get(
        f"/transactions?type=expense&date_from={(date.today() + timedelta(days=1)).isoformat()}",
        headers=auth["headers"],
    )

    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["description"] == "Taxi"


@pytest.mark.anyio
async def test_transactions_support_update_for_owned_record(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    category_response = await client.get("/categories", headers=auth["headers"])
    account_id = account_response.json()["id"]
    fun_category_id = next(
        category["id"]
        for category in category_response.json()
        if category["key"] == "fun"
    )

    create_response = await client.post(
        "/transactions",
        json={
            "account_id": account_id,
            "amount": 85,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Dinner",
        },
        headers=auth["headers"],
    )
    transaction_id = create_response.json()["id"]

    update_response = await client.patch(
        f"/transactions/{transaction_id}",
        json={
            "amount": 95,
            "merchant": "Bistro",
            "category_id": fun_category_id,
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["amount"] == 95
    assert payload["merchant"] == "Bistro"
    assert payload["category_id"] == fun_category_id


@pytest.mark.anyio
async def test_transactions_cannot_update_another_users_record(client, register_user) -> None:
    first_user = await register_user(email="update-owner@example.com")
    second_user = await register_user(email="update-stranger@example.com")

    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=first_user["headers"],
    )
    transaction_response = await client.post(
        "/transactions",
        json={
            "account_id": account_response.json()["id"],
            "amount": 25,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Coffee",
        },
        headers=first_user["headers"],
    )

    update_response = await client.patch(
        f"/transactions/{transaction_response.json()['id']}",
        json={"amount": 30},
        headers=second_user["headers"],
    )

    assert update_response.status_code == 404
    assert update_response.json()["error"]["code"] == "not_found"


@pytest.mark.anyio
async def test_transactions_delete_only_hides_owned_record(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    create_response = await client.post(
        "/transactions",
        json={
            "account_id": account_response.json()["id"],
            "amount": 30,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Lunch",
        },
        headers=auth["headers"],
    )

    delete_response = await client.delete(
        f"/transactions/{create_response.json()['id']}",
        headers=auth["headers"],
    )
    list_response = await client.get("/transactions", headers=auth["headers"])

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json()["items"] == []


@pytest.mark.anyio
async def test_transactions_cannot_delete_another_users_record(client, register_user) -> None:
    first_user = await register_user(email="delete-owner@example.com")
    second_user = await register_user(email="delete-stranger@example.com")

    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=first_user["headers"],
    )
    transaction_response = await client.post(
        "/transactions",
        json={
            "account_id": account_response.json()["id"],
            "amount": 30,
            "currency": "EUR",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "Lunch",
        },
        headers=first_user["headers"],
    )

    delete_response = await client.delete(
        f"/transactions/{transaction_response.json()['id']}",
        headers=second_user["headers"],
    )

    assert delete_response.status_code == 404
    assert delete_response.json()["error"]["code"] == "not_found"


@pytest.mark.anyio
async def test_transactions_reject_invalid_payload(client, register_user) -> None:
    auth = await register_user()

    response = await client.post(
        "/transactions",
        json={
            "amount": -10,
            "currency": "EU",
            "type": "expense",
            "date": date.today().isoformat(),
            "description": "",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.anyio
async def test_financial_data_bundle_includes_transactions(client, register_user) -> None:
    auth = await register_user()
    account_response = await client.post(
        "/accounts",
        json={"name": "Main", "balance": 1000, "currency": "EUR"},
        headers=auth["headers"],
    )
    await client.post(
        "/transactions",
        json={
            "account_id": account_response.json()["id"],
            "amount": 1200,
            "currency": "EUR",
            "type": "income",
            "date": date.today().isoformat(),
            "description": "Salary",
        },
        headers=auth["headers"],
    )

    response = await client.get("/financial-data", headers=auth["headers"])

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["transactions"]) == 1
    assert payload["transactions"][0]["description"] == "Salary"
