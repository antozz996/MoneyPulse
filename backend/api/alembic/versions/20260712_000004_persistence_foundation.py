"""persistence foundation

Revision ID: 20260712_000004
Revises: 20260707_000003
Create Date: 2026-07-12 02:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260712_000004"
down_revision = "20260707_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_financial_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("locale", sa.String(length=16), nullable=False),
        sa.Column("salary_day", sa.Integer(), nullable=True),
        sa.Column("protected_balance", sa.Float(), nullable=False),
        sa.Column("risk_profile", sa.String(length=32), nullable=False),
        sa.Column("default_cycle_mode", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        op.f("ix_user_financial_profiles_user_id"),
        "user_financial_profiles",
        ["user_id"],
        unique=True,
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("entry_type", sa.String(length=16), nullable=False),
        sa.Column("icon_key", sa.String(length=64), nullable=True),
        sa.Column("color_key", sa.String(length=32), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "key"),
    )
    op.create_index(op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False)

    op.create_table(
        "budgets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("period", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_budgets_user_id"), "budgets", ["user_id"], unique=False)

    op.add_column("accounts", sa.Column("account_type", sa.String(length=32), nullable=True))
    op.add_column("accounts", sa.Column("is_default", sa.Boolean(), nullable=True))
    op.add_column("accounts", sa.Column("status", sa.String(length=32), nullable=True))
    op.add_column("accounts", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("transactions", sa.Column("account_id", sa.Integer(), nullable=True))
    op.add_column("transactions", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("transactions", sa.Column("merchant", sa.String(length=255), nullable=True))
    op.add_column("transactions", sa.Column("status", sa.String(length=32), nullable=True))
    op.add_column("transactions", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("recurring_events", sa.Column("account_id", sa.Integer(), nullable=True))
    op.add_column("recurring_events", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("recurring_events", sa.Column("next_due_date", sa.Date(), nullable=True))
    op.add_column("recurring_events", sa.Column("status", sa.String(length=32), nullable=True))
    op.add_column("recurring_events", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("goals", sa.Column("current_amount", sa.Float(), nullable=True))
    op.add_column("goals", sa.Column("monthly_contribution", sa.Float(), nullable=True))
    op.add_column("goals", sa.Column("priority", sa.String(length=32), nullable=True))
    op.add_column("goals", sa.Column("deadline", sa.Date(), nullable=True))
    op.add_column("goals", sa.Column("status", sa.String(length=32), nullable=True))
    op.add_column("goals", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.execute("UPDATE accounts SET account_type = 'cash' WHERE account_type IS NULL")
    op.execute("UPDATE accounts SET is_default = 0 WHERE is_default IS NULL")
    op.execute("UPDATE accounts SET status = 'active' WHERE status IS NULL")
    op.execute("UPDATE accounts SET updated_at = created_at WHERE updated_at IS NULL")

    op.execute("UPDATE transactions SET status = 'posted' WHERE status IS NULL")
    op.execute("UPDATE transactions SET updated_at = created_at WHERE updated_at IS NULL")

    op.execute("UPDATE recurring_events SET next_due_date = start_date WHERE next_due_date IS NULL")
    op.execute("UPDATE recurring_events SET status = 'active' WHERE status IS NULL")
    op.execute("UPDATE recurring_events SET updated_at = created_at WHERE updated_at IS NULL")

    op.execute("UPDATE goals SET current_amount = reserved_amount WHERE current_amount IS NULL")
    op.execute("UPDATE goals SET monthly_contribution = planned_contribution WHERE monthly_contribution IS NULL")
    op.execute(
        "UPDATE goals SET priority = CASE WHEN kind = 'safety_buffer' THEN 'ESSENTIAL' ELSE 'IMPORTANT' END WHERE priority IS NULL"
    )
    op.execute("UPDATE goals SET status = 'active' WHERE status IS NULL")
    op.execute("UPDATE goals SET updated_at = created_at WHERE updated_at IS NULL")

    with op.batch_alter_table("accounts") as batch_op:
        batch_op.alter_column("account_type", nullable=False)
        batch_op.alter_column("is_default", nullable=False)
        batch_op.alter_column("status", nullable=False)
        batch_op.alter_column("updated_at", nullable=False)

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.alter_column("status", nullable=False)
        batch_op.alter_column("updated_at", nullable=False)

    with op.batch_alter_table("recurring_events") as batch_op:
        batch_op.alter_column("status", nullable=False)
        batch_op.alter_column("updated_at", nullable=False)

    with op.batch_alter_table("goals") as batch_op:
        batch_op.alter_column("current_amount", nullable=False)
        batch_op.alter_column("monthly_contribution", nullable=False)
        batch_op.alter_column("priority", nullable=False)
        batch_op.alter_column("status", nullable=False)
        batch_op.alter_column("updated_at", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("goals") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("status")
        batch_op.drop_column("deadline")
        batch_op.drop_column("priority")
        batch_op.drop_column("monthly_contribution")
        batch_op.drop_column("current_amount")

    with op.batch_alter_table("recurring_events") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("status")
        batch_op.drop_column("next_due_date")
        batch_op.drop_column("category_id")
        batch_op.drop_column("account_id")

    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("status")
        batch_op.drop_column("merchant")
        batch_op.drop_column("category_id")
        batch_op.drop_column("account_id")

    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("status")
        batch_op.drop_column("is_default")
        batch_op.drop_column("account_type")

    op.drop_index(op.f("ix_budgets_user_id"), table_name="budgets")
    op.drop_table("budgets")
    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_table("categories")
    op.drop_index(op.f("ix_user_financial_profiles_user_id"), table_name="user_financial_profiles")
    op.drop_table("user_financial_profiles")
