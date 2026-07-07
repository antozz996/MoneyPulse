"""bank sync foundation

Revision ID: 20260707_000003
Revises: 20260707_000002
Create Date: 2026-07-07 00:00:03
"""

from alembic import op
import sqlalchemy as sa


revision = "20260707_000003"
down_revision = "20260707_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("source", sa.String(length=32), nullable=True))
    op.add_column("transactions", sa.Column("source", sa.String(length=32), nullable=True))
    op.execute("UPDATE accounts SET source = 'manual' WHERE source IS NULL")
    op.execute("UPDATE transactions SET source = 'manual' WHERE source IS NULL")
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.alter_column("source", nullable=False)
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("source", nullable=False)

    op.create_table(
        "bank_connections",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("institution_id", sa.String(length=255), nullable=True),
        sa.Column("institution_name", sa.String(length=255), nullable=False),
        sa.Column("connection_reference", sa.String(length=255), nullable=False),
        sa.Column("external_connection_id", sa.String(length=255), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_reference"),
    )
    op.create_index(
        op.f("ix_bank_connections_user_id"),
        "bank_connections",
        ["user_id"],
        unique=False,
    )
    op.create_table(
        "bank_accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("bank_connection_id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("external_account_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["bank_connection_id"], ["bank_connections.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bank_connection_id", "external_account_id"),
    )
    op.create_index(op.f("ix_bank_accounts_user_id"), "bank_accounts", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_bank_accounts_bank_connection_id"),
        "bank_accounts",
        ["bank_connection_id"],
        unique=False,
    )
    op.create_index(op.f("ix_bank_accounts_account_id"), "bank_accounts", ["account_id"], unique=False)
    op.create_table(
        "imported_transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("bank_connection_id", sa.Integer(), nullable=False),
        sa.Column("bank_account_id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("external_transaction_id", sa.String(length=255), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["bank_account_id"], ["bank_accounts.id"]),
        sa.ForeignKeyConstraint(["bank_connection_id"], ["bank_connections.id"]),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bank_account_id", "external_transaction_id"),
    )
    op.create_index(
        op.f("ix_imported_transactions_user_id"),
        "imported_transactions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_imported_transactions_bank_connection_id"),
        "imported_transactions",
        ["bank_connection_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_imported_transactions_bank_account_id"),
        "imported_transactions",
        ["bank_account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_imported_transactions_transaction_id"),
        "imported_transactions",
        ["transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_imported_transactions_transaction_id"), table_name="imported_transactions")
    op.drop_index(op.f("ix_imported_transactions_bank_account_id"), table_name="imported_transactions")
    op.drop_index(op.f("ix_imported_transactions_bank_connection_id"), table_name="imported_transactions")
    op.drop_index(op.f("ix_imported_transactions_user_id"), table_name="imported_transactions")
    op.drop_table("imported_transactions")
    op.drop_index(op.f("ix_bank_accounts_account_id"), table_name="bank_accounts")
    op.drop_index(op.f("ix_bank_accounts_bank_connection_id"), table_name="bank_accounts")
    op.drop_index(op.f("ix_bank_accounts_user_id"), table_name="bank_accounts")
    op.drop_table("bank_accounts")
    op.drop_index(op.f("ix_bank_connections_user_id"), table_name="bank_connections")
    op.drop_table("bank_connections")
    op.drop_column("transactions", "source")
    op.drop_column("accounts", "source")
