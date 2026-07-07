from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.accounts import router as accounts_router
from app.api.routes.auth import router as auth_router
from app.api.routes.before_you_buy import router as before_you_buy_router
from app.api.routes.checkpoints import router as checkpoints_router
from app.api.routes.goals import router as goals_router
from app.api.routes.health import router as health_router
from app.api.routes.recurring_events import router as recurring_events_router
from app.api.routes.today import router as today_router
from app.api.routes.transactions import router as transactions_router
from app.config import Settings
from app.database import create_engine_from_settings, create_session_maker
from app.errors import ApiError, normalize_error_details, validation_error
from app.init_db import upgrade_database
from app.services.decisioning import CoreCliDecisionEngineAdapter


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
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
    app.include_router(accounts_router)
    app.include_router(transactions_router)
    app.include_router(goals_router)
    app.include_router(recurring_events_router)
    app.include_router(checkpoints_router)
    app.include_router(today_router)
    app.include_router(before_you_buy_router)

    return app


app = create_app()
