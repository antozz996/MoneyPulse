"""financial onboarding state

Revision ID: 20260712_000007
Revises: 20260712_000006
Create Date: 2026-07-12 21:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260712_000007"
down_revision = "20260712_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_financial_profiles",
        sa.Column("onboarding_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("onboarding_step", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("setup_quality_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("missing_setup_fields", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("protected_balance_configured", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("zero_balance_declared", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "user_financial_profiles",
        sa.Column("cycle_configured", sa.Boolean(), nullable=True),
    )

    op.execute(
        """
        UPDATE user_financial_profiles
        SET onboarding_status = 'not_started',
            onboarding_step = 'basics',
            setup_quality_score = 0,
            protected_balance_configured = 0,
            zero_balance_declared = 0,
            cycle_configured = 0
        """
    )

    with op.batch_alter_table("user_financial_profiles") as batch_op:
        batch_op.alter_column("onboarding_status", nullable=False)
        batch_op.alter_column("setup_quality_score", nullable=False)
        batch_op.alter_column("protected_balance_configured", nullable=False)
        batch_op.alter_column("zero_balance_declared", nullable=False)
        batch_op.alter_column("cycle_configured", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("user_financial_profiles") as batch_op:
        batch_op.drop_column("cycle_configured")
        batch_op.drop_column("zero_balance_declared")
        batch_op.drop_column("protected_balance_configured")
        batch_op.drop_column("missing_setup_fields")
        batch_op.drop_column("setup_quality_score")
        batch_op.drop_column("onboarding_completed_at")
        batch_op.drop_column("onboarding_step")
        batch_op.drop_column("onboarding_status")
