import pytest


@pytest.mark.anyio
async def test_validation_errors_return_consistent_payload(client, register_user) -> None:
    auth = await register_user()
    response = await client.post(
        "/accounts",
        json={
            "name": " ",
            "balance": 100,
            "currency": "EURO",
        },
        headers=auth["headers"],
    )

    assert response.status_code == 422
    payload = response.json()["error"]
    assert payload["code"] == "validation_error"
    assert payload["message"] == "Request validation failed."
    assert isinstance(payload["details"], list)
