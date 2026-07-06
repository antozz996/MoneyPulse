from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    database_url: str
    demo_user_id: str
    demo_user_name: str
    default_currency: str
    model_version: str
    repo_root: Path
    core_cli_command: tuple[str, ...]

    @classmethod
    def from_env(cls) -> "Settings":
        repo_root = Path(__file__).resolve().parents[3]
        core_cli_path = repo_root / "backend/api/app/adapters/decision_engine_cli.ts"
        tsx_loader_path = repo_root / "packages/core/node_modules/tsx/dist/loader.mjs"

        return cls(
            database_url=os.getenv(
                "MONEYPULSE_DATABASE_URL",
                "sqlite+pysqlite:///./moneypulse.db",
            ),
            demo_user_id=os.getenv("MONEYPULSE_DEMO_USER_ID", "demo-user"),
            demo_user_name=os.getenv("MONEYPULSE_DEMO_USER_NAME", "Demo User"),
            default_currency=os.getenv("MONEYPULSE_DEFAULT_CURRENCY", "EUR"),
            model_version=os.getenv("MONEYPULSE_MODEL_VERSION", "1.0.0"),
            repo_root=repo_root,
            core_cli_command=(
                "node",
                "--import",
                str(tsx_loader_path),
                str(core_cli_path),
            ),
        )
