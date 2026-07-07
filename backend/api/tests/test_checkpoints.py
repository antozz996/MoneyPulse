from datetime import date, timedelta

import pytest


@pytest.mark.anyio
async def test_checkpoints_support_crud(client, register_user) -> None:
    auth = await register_user()
    create_response = await client.post(
        "/checkpoints",
        json={
            "name": "Rent due",
            "amount": 800,
            "currency": "EUR",
            "effective_date": date.today().isoformat(),
            "note": "Landlord debit",
        },
        headers=auth["headers"],
    )

    assert create_response.status_code == 201
    checkpoint_id = create_response.json()["id"]

    list_response = await client.get("/checkpoints", headers=auth["headers"])

    assert list_response.status_code == 200
    assert list_response.json()[0]["note"] == "Landlord debit"

    update_response = await client.put(
        f"/checkpoints/{checkpoint_id}",
        json={
            "name": "Rent due updated",
            "amount": 825,
            "currency": "EUR",
            "effective_date": (date.today() + timedelta(days=1)).isoformat(),
            "note": "Updated note",
        },
        headers=auth["headers"],
    )

    assert update_response.status_code == 200
    assert update_response.json()["amount"] == 825

    delete_response = await client.delete(
        f"/checkpoints/{checkpoint_id}",
        headers=auth["headers"],
    )

    assert delete_response.status_code == 204
    assert (await client.get("/checkpoints", headers=auth["headers"])).json() == []
