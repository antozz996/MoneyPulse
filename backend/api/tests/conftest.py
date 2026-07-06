from collections.abc import AsyncGenerator
from pathlib import Path

import httpx
import pytest

from app.config import Settings
from app.main import create_app


@pytest.fixture
async def client(tmp_path: Path) -> AsyncGenerator[httpx.AsyncClient, None]:
    database_path = tmp_path / "moneypulse-test.db"
    repo_root = Path(__file__).resolve().parents[3]
    settings = Settings(
        database_url=f"sqlite+pysqlite:///{database_path}",
        demo_user_id="demo-user",
        demo_user_name="Demo User",
        default_currency="EUR",
        model_version="1.0.0",
        repo_root=repo_root,
        core_cli_command=(
            "node",
            "--import",
            str(repo_root / "packages/core/node_modules/tsx/dist/loader.mjs"),
            str(repo_root / "backend/api/app/adapters/decision_engine_cli.ts"),
        ),
    )
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as test_client:
        yield test_client
