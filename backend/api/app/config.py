from dataclasses import dataclass
from pathlib import Path
import os


def _parse_csv_env(raw_value: str | None) -> tuple[str, ...]:
    if raw_value is None:
        return ()

    return tuple(
        item.strip()
        for item in raw_value.split(",")
        if item.strip()
    )


def _default_cors_allow_origins(environment: str) -> tuple[str, ...]:
    if environment.lower() in {"production", "prod"}:
        return ()

    return (
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://127.0.0.1:4174",
        "http://localhost:4174",
        "http://127.0.0.1:4175",
        "http://localhost:4175",
    )


@dataclass(frozen=True)
class Settings:
    database_url: str
    demo_user_id: str
    demo_user_name: str
    default_currency: str
    model_version: str
    environment: str
    cors_allow_origins: tuple[str, ...]
    repo_root: Path
    core_cli_command: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        repo_root = Path(__file__).resolve().parents[3]
        core_cli_path = repo_root / "backend/api/app/adapters/decision_engine_cli.ts"
        tsx_loader_path = repo_root / "packages/core/node_modules/tsx/dist/loader.mjs"
        environment = os.getenv("MONEYPULSE_ENVIRONMENT", "development")
        cors_allow_origins = _parse_csv_env(os.getenv("MONEYPULSE_CORS_ALLOW_ORIGINS"))

        return cls(
            database_url=os.getenv(
                "MONEYPULSE_DATABASE_URL",
                "sqlite+pysqlite:///./moneypulse.db",
            ),
            demo_user_id=os.getenv("MONEYPULSE_DEMO_USER_ID", "demo-user"),
            demo_user_name=os.getenv("MONEYPULSE_DEMO_USER_NAME", "Demo User"),
            default_currency=os.getenv("MONEYPULSE_DEFAULT_CURRENCY", "EUR"),
            model_version=os.getenv("MONEYPULSE_MODEL_VERSION", "1.0.0"),
            environment=environment,
            cors_allow_origins=(
                cors_allow_origins
                if cors_allow_origins
                else _default_cors_allow_origins(environment)
            ),
            repo_root=repo_root,
            core_cli_command=(
                "node",
                "--import",
                str(tsx_loader_path),
                str(core_cli_path),
            ),
        )
