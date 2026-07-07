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
