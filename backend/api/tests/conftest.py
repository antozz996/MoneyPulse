from collections.abc import AsyncGenerator, Callable
from pathlib import Path

import httpx
import pytest

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings_factory(tmp_path: Path) -> Callable[..., Settings]:
    repo_root = Path(__file__).resolve().parents[3]

    def build_settings(**overrides: object) -> Settings:
        database_path = tmp_path / "moneypulse-test.db"
        defaults: dict[str, object] = {
            "database_url": f"sqlite+pysqlite:///{database_path}",
            "demo_user_id": "demo-user",
            "demo_user_name": "Demo User",
            "default_currency": "EUR",
            "model_version": "1.0.0",
            "environment": "test",
            "cors_allow_origins": (),
            "repo_root": repo_root,
            "core_cli_command": (
                "node",
                "--import",
                str(repo_root / "packages/core/node_modules/tsx/dist/loader.mjs"),
                str(repo_root / "backend/api/app/adapters/decision_engine_cli.ts"),
            ),
            "auth_secret_key": "test-secret-key",
            "auth_access_token_ttl_minutes": 60,
            "auth_rate_limit_window_seconds": 60,
            "auth_rate_limit_max_requests": 10,
            "coach_provider": "deterministic",
            "coach_llm_enabled": False,
            "copilot_provider": "mock",
            "copilot_llm_enabled": False,
            "copilot_openai_api_key": None,
            "log_level": "INFO",
        }
        defaults.update(overrides)
        return Settings(**defaults)

    return build_settings


@pytest.fixture
async def client(settings_factory: Callable[..., Settings]) -> AsyncGenerator[httpx.AsyncClient, None]:
    settings = settings_factory()
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as test_client:
        yield test_client


@pytest.fixture
def register_user(client: httpx.AsyncClient) -> Callable[..., object]:
    counter = 0

    async def create_user(**overrides: object) -> dict[str, object]:
        nonlocal counter
        counter += 1
        payload: dict[str, object] = {
            "name": f"User {counter}",
            "email": f"user{counter}@example.com",
            "password": "password123",
        }
        payload.update(overrides)
        response = await client.post("/auth/register", json=payload)
        assert response.status_code == 201, response.text
        session_payload = response.json()
        return {
            "session": session_payload,
            "headers": {
                "Authorization": f"Bearer {session_payload['access_token']}",
            },
            "credentials": payload,
        }

    return create_user
