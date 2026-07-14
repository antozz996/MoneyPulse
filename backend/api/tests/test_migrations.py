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


def test_financial_onboarding_uses_boolean_literals_for_backfill() -> None:
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20260712_000007_financial_onboarding.py"
    )
    content = migration_path.read_text()

    assert "protected_balance_configured = false" in content
    assert "zero_balance_declared = false" in content
    assert "cycle_configured = false" in content
    assert "protected_balance_configured = 0" not in content
    assert "zero_balance_declared = 0" not in content
    assert "cycle_configured = 0" not in content
