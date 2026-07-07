from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy import inspect

from app.config import Settings
from app.database import create_engine_from_settings, init_database

MANAGED_TABLES = {
    "users",
    "accounts",
    "transactions",
    "goals",
    "recurring_events",
    "checkpoints",
}


def upgrade_database(settings: Settings) -> None:
    engine = create_engine_from_settings(settings)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    has_revision = False

    if "alembic_version" in existing_tables:
        with engine.connect() as connection:
            has_revision = (
                connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                .scalar_one_or_none()
                is not None
            )

    config = Config(str(settings.repo_root / "backend/api/alembic.ini"))
    config.set_main_option(
        "script_location",
        str(settings.repo_root / "backend/api/alembic"),
    )
    config.set_main_option("sqlalchemy.url", settings.database_url)

    if (not has_revision) and existing_tables & MANAGED_TABLES:
        init_database(engine)
        command.stamp(config, "head")
        return

    command.upgrade(config, "head")


def main() -> None:
    upgrade_database(Settings.from_env())


if __name__ == "__main__":
    main()
