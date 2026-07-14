from pathlib import Path


def test_persistence_foundation_uses_boolean_literal_for_account_default() -> None:
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20260712_000004_persistence_foundation.py"
    )
    content = migration_path.read_text()

    assert "UPDATE accounts SET is_default = false WHERE is_default IS NULL" in content
    assert "UPDATE accounts SET is_default = 0 WHERE is_default IS NULL" not in content
