from dataclasses import dataclass
from pathlib import Path
import os


def _env_first(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value is not None:
            return value
    return None


def _parse_csv_env(raw_value: str | None) -> tuple[str, ...]:
    if raw_value is None:
        return ()

    return tuple(
        item.strip()
        for item in raw_value.split(",")
        if item.strip()
    )


def _parse_bool_env(raw_value: str | None, *, default: bool) -> bool:
    if raw_value is None:
        return default

    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


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


def _find_api_root(start: Path) -> Path:
    for candidate in (start, *start.parents):
        if (candidate / "alembic.ini").exists() and (candidate / "app").is_dir():
            return candidate

    raise FileNotFoundError("Could not resolve backend/api root from current path.")


def _find_workspace_root(api_root: Path) -> Path:
    for candidate in (api_root, *api_root.parents):
        if (candidate / "packages/core").is_dir():
            return candidate

    return api_root


def _resolve_core_cli_command(workspace_root: Path, api_root: Path) -> tuple[str, ...]:
    bundled_cli_path = api_root / "app/adapters/decision_engine_cli.mjs"
    if bundled_cli_path.exists():
        return (
            "node",
            "--experimental-specifier-resolution=node",
            str(bundled_cli_path),
        )

    tsx_loader_candidates = (
        workspace_root / "packages/core/node_modules/tsx/dist/loader.mjs",
        api_root / "node_modules/tsx/dist/loader.mjs",
    )
    cli_candidates = (
        workspace_root / "backend/api/app/adapters/decision_engine_cli.ts",
        api_root / "app/adapters/decision_engine_cli.ts",
    )

    for tsx_loader_path in tsx_loader_candidates:
        if not tsx_loader_path.exists():
            continue

        for core_cli_path in cli_candidates:
            if core_cli_path.exists():
                return (
                    "node",
                    "--import",
                    str(tsx_loader_path),
                    str(core_cli_path),
                )

    fallback_loader = tsx_loader_candidates[0]
    fallback_cli = cli_candidates[0]
    return (
        "node",
        "--import",
        str(fallback_loader),
        str(fallback_cli),
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
    api_root: Path
    repo_root: Path
    core_cli_command: tuple[str, ...]
    auth_secret_key: str
    auth_access_token_ttl_minutes: int
    auth_rate_limit_window_seconds: int
    auth_rate_limit_max_requests: int
    coach_provider: str
    coach_llm_enabled: bool
    copilot_provider: str
    copilot_llm_enabled: bool
    copilot_openai_api_key: str | None
    copilot_openai_model: str | None
    copilot_max_input_chars: int
    copilot_max_history_messages: int
    copilot_timeout_seconds: int
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        api_root = _find_api_root(Path(__file__).resolve().parent)
        repo_root = _find_workspace_root(api_root)
        environment = _env_first("MONEYPULSE_ENVIRONMENT", "ENVIRONMENT") or "development"
        cors_allow_origins = _parse_csv_env(
            _env_first("MONEYPULSE_CORS_ALLOW_ORIGINS", "CORS_ALLOWED_ORIGINS")
        )

        return cls(
            database_url=_env_first(
                "MONEYPULSE_DATABASE_URL",
                "DATABASE_URL",
                "SUPABASE_DATABASE_URL",
            )
            or "sqlite+pysqlite:///./moneypulse.db",
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
            api_root=api_root,
            repo_root=repo_root,
            core_cli_command=_resolve_core_cli_command(repo_root, api_root),
            auth_secret_key=os.getenv(
                "MONEYPULSE_AUTH_SECRET_KEY",
                "moneypulse-dev-secret-key",
            ),
            auth_access_token_ttl_minutes=int(
                os.getenv("MONEYPULSE_AUTH_ACCESS_TOKEN_TTL_MINUTES", "720")
            ),
            auth_rate_limit_window_seconds=int(
                os.getenv("MONEYPULSE_AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")
            ),
            auth_rate_limit_max_requests=int(
                os.getenv("MONEYPULSE_AUTH_RATE_LIMIT_MAX_REQUESTS", "10")
            ),
            coach_provider=os.getenv("MONEYPULSE_COACH_PROVIDER", "deterministic"),
            coach_llm_enabled=_parse_bool_env(
                os.getenv("MONEYPULSE_COACH_LLM_ENABLED"),
                default=False,
            ),
            copilot_provider=_env_first(
                "MONEYPULSE_COPILOT_PROVIDER",
                "COPILOT_PROVIDER",
            )
            or "mock",
            copilot_llm_enabled=_parse_bool_env(
                _env_first(
                    "MONEYPULSE_COPILOT_LLM_ENABLED",
                    "COPILOT_LIVE_AI_ENABLED",
                ),
                default=False,
            ),
            copilot_openai_api_key=_env_first(
                "MONEYPULSE_COPILOT_OPENAI_API_KEY",
                "OPENAI_API_KEY",
            ),
            copilot_openai_model=_env_first(
                "MONEYPULSE_COPILOT_OPENAI_MODEL",
                "OPENAI_MODEL",
            ),
            copilot_max_input_chars=int(
                _env_first(
                    "MONEYPULSE_COPILOT_MAX_INPUT_CHARS",
                    "COPILOT_MAX_INPUT_CHARS",
                )
                or "500"
            ),
            copilot_max_history_messages=int(
                _env_first(
                    "MONEYPULSE_COPILOT_MAX_HISTORY_MESSAGES",
                    "COPILOT_MAX_HISTORY_MESSAGES",
                )
                or "12"
            ),
            copilot_timeout_seconds=int(
                _env_first(
                    "MONEYPULSE_COPILOT_TIMEOUT_SECONDS",
                    "COPILOT_TIMEOUT_SECONDS",
                )
                or "15"
            ),
            log_level=os.getenv("MONEYPULSE_LOG_LEVEL", "INFO").strip().upper(),
        )
