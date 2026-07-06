from datetime import date

import pytest


@pytest.mark.anyio
async def test_transactions_endpoints_create_and_list_records(client) -> None:
    create_response = await client.post(
        "/transactions",
        json={
            "name": "Salary",
            "amount": 400,
            "currency": "EUR",
            "direction": "income",
            "effective_date": date.today().isoformat(),
        },
    )

    assert create_response.status_code == 201
    assert create_response.json()["direction"] == "income"

    expense_response = await client.post(
        "/transactions",
        json={
            "name": "Rent",
            "amount": 500,
            "currency": "EUR",
            "direction": "expense",
            "category": "essential",
            "effective_date": date.today().isoformat(),
        },
    )

    assert expense_response.status_code == 201

    list_response = await client.get("/transactions")

    assert list_response.status_code == 200
    assert len(list_response.json()) == 2


@pytest.mark.anyio
async def test_transactions_validate_expense_category_rules(client) -> None:
    response = await client.post(
        "/transactions",
        json={
            "name": "Invalid expense",
            "amount": 20,
            "currency": "EUR",
            "direction": "expense",
            "effective_date": date.today().isoformat(),
        },
    )

    assert response.status_code == 422
