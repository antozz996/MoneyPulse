from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import session_scope
from app.errors import authentication_error
from app.models import UserModel
from app.repositories.users import UserRepository
from app.services.accounts import AccountService
from app.services.auth import AuthService
from app.services.bank_sync import BankSyncProviders, BankSyncService
from app.services.checkpoints import CheckpointService
from app.services.decisioning import DecisioningService, DecisionEngineAdapter
from app.services.goals import GoalService
from app.services.recurring_events import RecurringEventService
from app.services.transactions import TransactionService
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def get_decision_adapter(request: Request) -> DecisionEngineAdapter:
    return request.app.state.decision_adapter


async def get_bank_sync_providers(request: Request) -> BankSyncProviders:
    return request.app.state.bank_sync_providers


async def get_session(request: Request) -> AsyncGenerator[Session, None]:
    for session in session_scope(request.app.state.session_maker):
        yield session


async def get_auth_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    return AuthService(UserRepository(session), settings)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> UserModel:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error()

    claims = decode_access_token(credentials.credentials, settings.auth_secret_key)
    return auth_service.get_user(claims.sub)


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


async def get_recurring_event_service(
    session: Session = Depends(get_session),
) -> RecurringEventService:
    return RecurringEventService(session)


async def get_checkpoint_service(
    session: Session = Depends(get_session),
) -> CheckpointService:
    return CheckpointService(session)


async def get_bank_sync_service(
    session: Session = Depends(get_session),
    providers: BankSyncProviders = Depends(get_bank_sync_providers),
) -> BankSyncService:
    return BankSyncService(session, providers)


async def get_decisioning_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
    adapter: DecisionEngineAdapter = Depends(get_decision_adapter),
) -> DecisioningService:
    return DecisioningService(session=session, settings=settings, adapter=adapter)
