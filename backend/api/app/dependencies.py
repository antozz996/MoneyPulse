from collections.abc import AsyncGenerator
from dataclasses import dataclass

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import session_scope
from app.errors import authentication_error
from app.models import UserModel
from app.rate_limit import FixedWindowRateLimiter
from app.repositories.users import UserRepository
from app.services.accounts import AccountService
from app.services.auth import AuthService
from app.services.bank_sync import BankSyncProviders, BankSyncService
from app.services.checkpoints import CheckpointService
from app.services.coach import CoachService
from app.services.coach_providers import CoachProviders
from app.services.copilot import CopilotService
from app.services.copilot_providers import CopilotProviders
from app.services.decisioning import DecisioningService, DecisionEngineAdapter
from app.services.financial_data import FinancialDataService
from app.services.goals import GoalService
from app.services.me import MeService
from app.services.recurring_events import RecurringEventService
from app.services.transactions import TransactionService
from app.security import decode_access_token, decode_signed_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedSession:
    user: UserModel
    mode: str
    token_subject: str | None
    is_demo: bool


async def get_settings(request: Request) -> Settings:
    return request.app.state.settings


async def get_decision_adapter(request: Request) -> DecisionEngineAdapter:
    return request.app.state.decision_adapter


async def get_bank_sync_providers(request: Request) -> BankSyncProviders:
    return request.app.state.bank_sync_providers


async def get_coach_providers(request: Request) -> CoachProviders:
    return request.app.state.coach_providers


async def get_copilot_providers(request: Request) -> CopilotProviders:
    return request.app.state.copilot_providers


async def get_auth_rate_limiter(request: Request) -> FixedWindowRateLimiter:
    return request.app.state.auth_rate_limiter


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
    return (await get_current_auth_session(credentials, auth_service, settings)).user


async def get_current_auth_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedSession:
    auth_mode = settings.auth_mode.strip().lower()

    if auth_mode == "demo":
        return _resolve_demo_session(credentials, auth_service, settings)

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error()

    if auth_mode == "supabase":
        return _resolve_supabase_session(credentials, auth_service, settings)

    claims = decode_access_token(credentials.credentials, settings.auth_secret_key)
    return AuthenticatedSession(
        user=auth_service.get_user(claims.sub),
        mode="app",
        token_subject=claims.sub,
        is_demo=False,
    )


def _resolve_demo_session(
    credentials: HTTPAuthorizationCredentials | None,
    auth_service: AuthService,
    settings: Settings,
) -> AuthenticatedSession:
    if credentials is None:
        user = auth_service.get_or_create_demo_user()
        return AuthenticatedSession(
            user=user,
            mode="demo",
            token_subject=user.id,
            is_demo=True,
        )

    if credentials.scheme.lower() != "bearer":
        raise authentication_error()

    claims = decode_access_token(credentials.credentials, settings.auth_secret_key)
    return AuthenticatedSession(
        user=auth_service.get_user(claims.sub),
        mode="app",
        token_subject=claims.sub,
        is_demo=False,
    )


def _resolve_supabase_session(
    credentials: HTTPAuthorizationCredentials,
    auth_service: AuthService,
    settings: Settings,
) -> AuthenticatedSession:
    if settings.supabase_jwt_secret:
        claims = decode_signed_token(
            credentials.credentials,
            settings.supabase_jwt_secret,
            require_email=False,
            expected_issuer=settings.supabase_jwt_issuer,
            expected_audience=settings.supabase_jwt_audience,
        )
        return AuthenticatedSession(
            user=auth_service.get_user(claims.sub),
            mode="supabase",
            token_subject=claims.sub,
            is_demo=False,
        )

    if settings.supabase_jwks_url:
        raise authentication_error(
            "Supabase JWKS verification is not implemented. Configure SUPABASE_JWT_SECRET for now."
        )

    raise authentication_error(
        "Supabase auth is enabled but JWT verification is not configured."
    )


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


async def get_financial_data_service(
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> FinancialDataService:
    return FinancialDataService(session, default_currency=settings.default_currency)


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


async def get_coach_service(
    session: Session = Depends(get_session),
    decisioning: DecisioningService = Depends(get_decisioning_service),
    providers: CoachProviders = Depends(get_coach_providers),
) -> CoachService:
    return CoachService(session=session, decisioning=decisioning, providers=providers)


async def get_me_service(
    session: Session = Depends(get_session),
) -> MeService:
    return MeService(session)


async def get_copilot_service(
    session: Session = Depends(get_session),
    decisioning: DecisioningService = Depends(get_decisioning_service),
    providers: CopilotProviders = Depends(get_copilot_providers),
    settings: Settings = Depends(get_settings),
) -> CopilotService:
    return CopilotService(
        session=session,
        decisioning=decisioning,
        providers=providers,
        settings=settings,
    )
