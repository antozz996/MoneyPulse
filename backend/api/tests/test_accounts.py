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
