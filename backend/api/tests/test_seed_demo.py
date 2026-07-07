from app.database import create_engine_from_settings, create_session_maker
from app.repositories.accounts import AccountRepository
from app.repositories.goals import GoalRepository
from app.repositories.transactions import TransactionRepository
from app.seed_demo import seed_demo_data


def test_seed_demo_data_creates_idempotent_demo_records(settings_factory) -> None:
    settings = settings_factory()

    first_summary = seed_demo_data(settings)
    second_summary = seed_demo_data(settings)

    engine = create_engine_from_settings(settings)
    session_maker = create_session_maker(engine)
    session = session_maker()

    try:
        accounts = AccountRepository(session).list_by_user(settings.demo_user_id)
        transactions = TransactionRepository(session).list_by_user(settings.demo_user_id)
        goals = GoalRepository(session).list_by_user(settings.demo_user_id)
    finally:
        session.close()

    assert first_summary.created is True
    assert first_summary.accounts == 1
    assert first_summary.transactions == 1
    assert first_summary.goals == 2

    assert second_summary.created is False
    assert second_summary.accounts == 1
    assert second_summary.transactions == 1
    assert second_summary.goals == 2

    assert len(accounts) == 1
    assert len(transactions) == 1
    assert len(goals) == 2
