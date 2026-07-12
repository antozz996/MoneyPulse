import pytest


@pytest.mark.anyio
async def test_bank_sync_mock_flow_imports_accounts_and_transactions(
    client,
    register_user,
) -> None:
    auth = await register_user()

    start_response = await client.post(
        "/bank/connect/start",
        json={"provider": "mock"},
        headers=auth["headers"],
    )

    assert start_response.status_code == 201
    start_payload = start_response.json()
    assert start_payload["provider"] == "mock"
    assert start_payload["status"] == "pending"

    complete_response = await client.post(
        "/bank/connect/complete",
        json={"connection_id": start_payload["connection_id"]},
        headers=auth["headers"],
    )

    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "active"
    assert complete_response.json()["linked_accounts"] == 2

    sync_response = await client.post(
        "/bank/sync",
        json={},
        headers=auth["headers"],
    )

    assert sync_response.status_code == 200
    assert sync_response.json() == {
        "connections_synced": 1,
        "accounts_upserted": 2,
        "imported_transactions": 3,
        "duplicate_transactions": 0,
    }

    accounts_response = await client.get("/accounts", headers=auth["headers"])
    transactions_response = await client.get("/transactions", headers=auth["headers"])
    connections_response = await client.get("/bank/connections", headers=auth["headers"])
    today_response = await client.get("/today", headers=auth["headers"])

    assert accounts_response.status_code == 200
    assert len(accounts_response.json()) == 2
    assert {account["source"] for account in accounts_response.json()} == {"bank_import"}

    assert transactions_response.status_code == 200
    assert len(transactions_response.json()["items"]) == 3
    assert {
        transaction["source"] for transaction in transactions_response.json()["items"]
    } == {"bank_import"}

    assert connections_response.status_code == 200
    assert connections_response.json()[0]["linked_accounts"] == 2
    assert connections_response.json()[0]["last_sync_at"] is not None

    assert today_response.status_code == 200
    assert today_response.json()["inputs"]["available_balance"] == 2750


@pytest.mark.anyio
async def test_bank_sync_prevents_duplicate_transaction_imports(client, register_user) -> None:
    auth = await register_user()

    start_response = await client.post(
        "/bank/connect/start",
        json={"provider": "mock"},
        headers=auth["headers"],
    )
    connection_id = start_response.json()["connection_id"]

    await client.post(
        "/bank/connect/complete",
        json={"connection_id": connection_id},
        headers=auth["headers"],
    )

    first_sync_response = await client.post(
        "/bank/sync",
        json={"connection_id": connection_id},
        headers=auth["headers"],
    )
    second_sync_response = await client.post(
        "/bank/sync",
        json={"connection_id": connection_id},
        headers=auth["headers"],
    )
    transactions_response = await client.get("/transactions", headers=auth["headers"])

    assert first_sync_response.status_code == 200
    assert second_sync_response.status_code == 200
    assert second_sync_response.json()["imported_transactions"] == 0
    assert second_sync_response.json()["duplicate_transactions"] == 3
    assert len(transactions_response.json()["items"]) == 3


@pytest.mark.anyio
async def test_bank_connections_are_scoped_to_authenticated_user(client, register_user) -> None:
    first_user = await register_user(email="bank-a@example.com")
    second_user = await register_user(email="bank-b@example.com")

    start_response = await client.post(
        "/bank/connect/start",
        json={"provider": "mock"},
        headers=first_user["headers"],
    )
    connection_id = start_response.json()["connection_id"]

    other_user_list = await client.get("/bank/connections", headers=second_user["headers"])
    other_user_delete = await client.delete(
        f"/bank/connections/{connection_id}",
        headers=second_user["headers"],
    )

    assert other_user_list.status_code == 200
    assert other_user_list.json() == []
    assert other_user_delete.status_code == 404
