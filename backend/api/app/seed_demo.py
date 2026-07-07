from dataclasses import asdict, dataclass
from datetime import date, timedelta
import json

from app.config import Settings
from app.database import create_engine_from_settings, create_session_maker
from app.init_db import upgrade_database
from app.repositories.accounts import AccountRepository
from app.repositories.goals import GoalRepository
from app.repositories.transactions import TransactionRepository
from app.repositories.users import UserRepository
from app.schemas.accounts import AccountCreate
from app.schemas.goals import GoalCreate
from app.schemas.transactions import TransactionCreate
from app.services.accounts import AccountService
from app.services.goals import GoalService
from app.services.transactions import TransactionService


@dataclass(frozen=True)
class DemoSeedSummary:
    user_id: str
    created: bool
    accounts: int
    transactions: int
    goals: int


def seed_demo_data(settings: Settings) -> DemoSeedSummary:
    upgrade_database(settings)
    engine = create_engine_from_settings(settings)
    session_maker = create_session_maker(engine)

    session = session_maker()
    try:
        user = UserRepository(session).get_or_create_demo_user(
            demo_user_id=settings.demo_user_id,
            demo_user_name=settings.demo_user_name,
        )
        existing_accounts = AccountRepository(session).list_by_user(user.id)
        existing_transactions = TransactionRepository(session).list_by_user(user.id)
        existing_goals = GoalRepository(session).list_by_user(user.id)

        if existing_accounts or existing_transactions or existing_goals:
            return DemoSeedSummary(
                user_id=user.id,
                created=False,
                accounts=len(existing_accounts),
                transactions=len(existing_transactions),
                goals=len(existing_goals),
            )

        account_service = AccountService(session)
        transaction_service = TransactionService(session)
        goal_service = GoalService(session)
        tomorrow = date.today() + timedelta(days=1)

        account_service.create_account(
            user.id,
            AccountCreate(
                name="Main account",
                balance=2400,
                currency=settings.default_currency,
            ),
        )
        transaction_service.create_transaction(
            user.id,
            TransactionCreate(
                name="Rent",
                amount=900,
                currency=settings.default_currency,
                direction="expense",
                category="essential",
                effective_date=tomorrow,
            ),
        )
        goal_service.create_goal(
            user.id,
            GoalCreate(
                name="Emergency buffer",
                target_amount=3000,
                planned_contribution=0,
                reserved_amount=500,
                currency=settings.default_currency,
                kind="safety_buffer",
            ),
        )
        goal_service.create_goal(
            user.id,
            GoalCreate(
                name="Holiday fund",
                target_amount=2000,
                planned_contribution=150,
                reserved_amount=0,
                currency=settings.default_currency,
                kind="goal",
            ),
        )

        return DemoSeedSummary(
            user_id=user.id,
            created=True,
            accounts=1,
            transactions=1,
            goals=2,
        )
    finally:
        session.close()


def main() -> None:
    summary = seed_demo_data(Settings.from_env())
    print(json.dumps(asdict(summary), indent=2))


if __name__ == "__main__":
    main()
