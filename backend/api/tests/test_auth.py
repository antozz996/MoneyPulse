import pytest


@pytest.mark.anyio
async def test_register_login_and_logout_flow(client) -> None:
    register_response = await client.post(
        "/auth/register",
        json={
            "name": "Antonio",
            "email": "antonio@example.com",
            "password": "password123",
        },
    )

    assert register_response.status_code == 201
    register_payload = register_response.json()
    assert register_payload["token_type"] == "bearer"
    assert register_payload["user"]["email"] == "antonio@example.com"

    login_response = await client.post(
        "/auth/login",
        json={
            "email": "antonio@example.com",
            "password": "password123",
        },
    )

    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload["user"]["id"] == register_payload["user"]["id"]

    logout_response = await client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {login_payload['access_token']}"},
    )

    assert logout_response.status_code == 204


@pytest.mark.anyio
async def test_register_rejects_duplicate_email(client, register_user) -> None:
    await register_user(email="existing@example.com")

    response = await client.post(
        "/auth/register",
        json={
            "name": "Existing",
            "email": "existing@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


@pytest.mark.anyio
async def test_login_rejects_invalid_credentials(client, register_user) -> None:
    await register_user(email="secure@example.com")

    response = await client.post(
        "/auth/login",
        json={
            "email": "secure@example.com",
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.anyio
async def test_authenticated_user_cannot_access_another_users_data(
    client,
    register_user,
) -> None:
    first_user = await register_user(email="first@example.com")
    second_user = await register_user(email="second@example.com")

    create_response = await client.post(
        "/accounts",
        json={
            "name": "Private account",
            "balance": 700,
            "currency": "EUR",
        },
        headers=first_user["headers"],
    )
    account_id = create_response.json()["id"]

    list_response = await client.get("/accounts", headers=second_user["headers"])
    delete_response = await client.delete(
        f"/accounts/{account_id}",
        headers=second_user["headers"],
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert delete_response.status_code == 404
    assert delete_response.json()["error"]["code"] == "not_found"
