import httpx
import pytest

from app.main import create_app


@pytest.mark.anyio
async def test_cors_allows_configured_origin(settings_factory) -> None:
    origin = "http://127.0.0.1:4173"
    app = create_app(settings_factory(cors_allow_origins=(origin,)))
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get("/health", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


@pytest.mark.anyio
async def test_cors_does_not_expose_unconfigured_origin(settings_factory) -> None:
    app = create_app(
        settings_factory(
            environment="production",
            cors_allow_origins=(),
        )
    )
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        response = await client.get("/health", headers={"Origin": "https://app.moneypulse.test"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
