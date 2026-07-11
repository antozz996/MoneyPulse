import pytest


@pytest.mark.anyio
async def test_healthcheck(client) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "moneypulse-api"}


@pytest.mark.anyio
async def test_readiness_check(client) -> None:
    response = await client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"database": "ok"}}


@pytest.mark.anyio
async def test_api_healthcheck(client) -> None:
    response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
