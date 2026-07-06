from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import session_scope
from app.repositories.users import UserRepository
from app.services.accounts import AccountService
from app.services.decisioning import DecisioningService, DecisionEngineAdapter
from app.services.goals import GoalService
from app.services.transactions import TransactionService


async def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def get_decision_adapter(request: Request) -> DecisionEngineAdapter:
    return request.app.state.decision_adapter


async def get_session(request: Request) -> AsyncGenerator[Session, None]:
    for session in session_scope(request.app.state.session_maker):
        yield session


async def get_demo_user_id(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> str:
    user = UserRepository(session).get_or_create_demo_user(
        demo_user_id=settings.demo_user_id,
        demo_user_name=settings.demo_user_name,
    )
    return user.id


async def get_account_service(
    session: Session = Depends(get_session),
) -> AccountService:
    return AccountService(session)


async def get_transaction_service(
    session: Session = Depends(get_session),
) -> TransactionService:
    return TransactionService(session)


async def get_goal_service(session: Session = Depends(get_session)) -> GoalService:
    return GoalService(session)


async def get_decisioning_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    adapter: DecisionEngineAdapter = Depends(get_decision_adapter),
) -> DecisioningService:
    return DecisioningService(session=session, settings=settings, adapter=adapter)
