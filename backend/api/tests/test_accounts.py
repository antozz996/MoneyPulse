import pytest


@pytest.mark.anyio
async def test_accounts_endpoints_are_scoped_to_authenticated_user(
    client,
    register_user,
) -> None:
    primary_user = await register_user()
    secondary_user = await register_user()

    response = await client.get("/accounts", headers=primary_user["headers"])
    assert response.json() == []

    create_response = await client.post(
        "/accounts",
        json={
            "name": "Main account",
            "balance": 1650,
            "currency": "EUR",
        },
        headers=primary_user["headers"],
    )

    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Main account"

    list_response = await client.get("/accounts", headers=primary_user["headers"])
    other_list_response = await client.get("/accounts", headers=secondary_user["headers"])

    assert list_response.status_code == 200
    assert list_response.json()[0]["balance"] == 1650
    assert other_list_response.json() == []


@pytest.mark.anyio
async def test_accounts_endpoints_update_and_delete_records(client, register_user) -> None:
    auth = await register_user()
    create_response = await client.post(
        "/accounts",
        json={
            "name": "Main account",
            "balance": 1650,
            "currency": "EUR",
        },
        headers=auth["headers"],
    )
    account_id = create_response.json()["id"]

    update_response = await client.put(
        f"/accounts/{account_id}",
        json={
            "name": "Updated account",
            "balance": 1900,
            "currency": "EUR",
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated account"
    assert update_response.json()["balance"] == 1900

    delete_response = await client.delete(f"/accounts/{account_id}", headers=auth["headers"])

    assert delete_response.status_code == 204
    assert delete_response.text == ""
    assert (await client.get("/accounts", headers=auth["headers"])).json() == []


@pytest.mark.anyio
async def test_accounts_return_not_found_errors_for_missing_records(client, register_user) -> None:
    auth = await register_user()
    response = await client.put(
        "/accounts/999",
        json={
            "name": "Missing account",
            "balance": 10,
            "currency": "EUR",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "not_found",
        "message": "account 999 was not found.",
        "details": {"resource": "account", "resource_id": 999},
    }


@pytest.mark.anyio
async def test_accounts_require_authentication(client) -> None:
    response = await client.get("/accounts")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"
