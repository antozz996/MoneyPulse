import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.accounts import router as accounts_router
from app.api.routes.auth import router as auth_router
from app.api.routes.bank_sync import router as bank_sync_router
from app.api.routes.before_you_buy import router as before_you_buy_router
from app.api.routes.checkpoints import router as checkpoints_router
from app.api.routes.coach import router as coach_router
from app.api.routes.copilot import router as copilot_router
from app.api.routes.goals import router as goals_router
from app.api.routes.health import router as health_router
from app.api.routes.me import router as me_router
from app.api.routes.recurring_events import router as recurring_events_router
from app.api.routes.today import router as today_router
from app.api.routes.transactions import router as transactions_router
from app.config import Settings
from app.database import create_engine_from_settings, create_session_maker
from app.errors import ApiError, normalize_error_details, validation_error
from app.init_db import upgrade_database
from app.logging_utils import configure_logging, log_structured
from app.rate_limit import FixedWindowRateLimiter
from app.services.bank_providers import MockBankProvider
from app.services.bank_sync import BankSyncProviders
from app.services.coach_providers import (
    CoachProviders,
    DeterministicCoachProvider,
    OptionalLlmCoachProvider,
)
from app.services.copilot_providers import (
    CopilotProviders,
    DeterministicCopilotProvider,
    OptionalLlmCopilotProvider,
)
from app.services.decisioning import CoreCliDecisionEngineAdapter

logger = logging.getLogger("moneypulse.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    configure_logging(resolved_settings.log_level)
    upgrade_database(resolved_settings)
    engine = create_engine_from_settings(resolved_settings)
    session_maker = create_session_maker(engine)

    app = FastAPI(
        title="MoneyPulse API",
        version="0.2.0",
        summary="Backend foundation for MoneyPulse decision intelligence.",
    )

    if resolved_settings.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(resolved_settings.cors_allow_origins),
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.state.settings = resolved_settings
    app.state.session_maker = session_maker
    app.state.decision_adapter = CoreCliDecisionEngineAdapter(resolved_settings)
    app.state.auth_rate_limiter = FixedWindowRateLimiter(
        max_requests=resolved_settings.auth_rate_limit_max_requests,
        window_seconds=resolved_settings.auth_rate_limit_window_seconds,
    )
    app.state.bank_sync_providers = BankSyncProviders(
        providers={
            "mock": MockBankProvider(),
        }
    )
    app.state.coach_providers = CoachProviders(
        default_provider_name=resolved_settings.coach_provider,
        llm_enabled=resolved_settings.coach_llm_enabled,
        providers={
            "deterministic": DeterministicCoachProvider(),
            "llm": OptionalLlmCoachProvider(),
        },
    )
    app.state.copilot_providers = CopilotProviders(
        default_provider_name=resolved_settings.copilot_provider,
        llm_enabled=resolved_settings.copilot_llm_enabled,
        openai_api_key=resolved_settings.copilot_openai_api_key,
        providers={
            "mock": DeterministicCopilotProvider(),
            "openai": OptionalLlmCopilotProvider(),
        },
    )

    @app.middleware("http")
    async def structured_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid4())
        started_at = perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((perf_counter() - started_at) * 1000, 2)
            log_structured(
                logger,
                event="http_request",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=500,
                duration_ms=duration_ms,
            )
            raise

        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        log_structured(
            logger,
            event="http_request",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response

    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": normalize_error_details(exc.details),
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(
        _: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        error = validation_error("Request validation failed.", exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "details": normalize_error_details(error.details),
                }
            },
        )

    @app.exception_handler(ValueError)
    async def handle_value_error(_: Request, exc: ValueError) -> JSONResponse:
        error = validation_error(str(exc))
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "details": normalize_error_details(error.details),
                }
            },
        )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(me_router)
    app.include_router(bank_sync_router)
    app.include_router(accounts_router)
    app.include_router(transactions_router)
    app.include_router(goals_router)
    app.include_router(recurring_events_router)
    app.include_router(checkpoints_router)
    app.include_router(today_router)
    app.include_router(before_you_buy_router)
    app.include_router(coach_router)
    app.include_router(copilot_router)

    return app


app = create_app()
