"""transaction categorization rules

Revision ID: 20260712_000006
Revises: 20260712_000005
Create Date: 2026-07-12 18:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260712_000006"
down_revision = "20260712_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "transaction_categorization_rules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("normalized_pattern", sa.String(length=255), nullable=False),
        sa.Column("match_type", sa.String(length=16), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("normalized_merchant", sa.String(length=255), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("usage_count", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "normalized_pattern", "match_type"),
    )
    op.create_index(
        op.f("ix_transaction_categorization_rules_user_id"),
        "transaction_categorization_rules",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transaction_categorization_rules_category_id"),
        "transaction_categorization_rules",
        ["category_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_transaction_categorization_rules_category_id"),
        table_name="transaction_categorization_rules",
    )
    op.drop_index(
        op.f("ix_transaction_categorization_rules_user_id"),
        table_name="transaction_categorization_rules",
    )
    op.drop_table("transaction_categorization_rules")
