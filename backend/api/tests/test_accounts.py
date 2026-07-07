import pytest


@pytest.mark.anyio
async def test_accounts_endpoints_support_demo_user_mode(client) -> None:
    response = await client.get("/accounts")
    assert response.json() == []

    create_response = await client.post(
        "/accounts",
        json={
            "name": "Main account",
            "balance": 1650,
            "currency": "EUR",
        },
    )

    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Main account"

    list_response = await client.get("/accounts")

    assert list_response.status_code == 200
    assert list_response.json()[0]["balance"] == 1650


@pytest.mark.anyio
async def test_accounts_endpoints_update_and_delete_records(client) -> None:
    create_response = await client.post(
        "/accounts",
        json={
            "name": "Main account",
            "balance": 1650,
            "currency": "EUR",
        },
    )
    account_id = create_response.json()["id"]

    update_response = await client.put(
        f"/accounts/{account_id}",
        json={
            "name": "Updated account",
            "balance": 1900,
            "currency": "EUR",
        },
    )

    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated account"
    assert update_response.json()["balance"] == 1900

    delete_response = await client.delete(f"/accounts/{account_id}")

    assert delete_response.status_code == 204
    assert delete_response.text == ""
    assert (await client.get("/accounts")).json() == []


@pytest.mark.anyio
async def test_accounts_return_not_found_errors_for_missing_records(client) -> None:
    response = await client.put(
        "/accounts/999",
        json={
            "name": "Missing account",
            "balance": 10,
            "currency": "EUR",
        },
    )

    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "not_found",
        "message": "account 999 was not found.",
        "details": {"resource": "account", "resource_id": 999},
    }
