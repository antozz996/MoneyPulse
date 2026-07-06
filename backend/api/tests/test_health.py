import pytest


@pytest.mark.anyio
async def test_healthcheck(client) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
