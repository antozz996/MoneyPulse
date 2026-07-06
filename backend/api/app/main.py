from fastapi import FastAPI

from app.api.routes.accounts import router as accounts_router
from app.api.routes.before_you_buy import router as before_you_buy_router
from app.api.routes.goals import router as goals_router
from app.api.routes.health import router as health_router
from app.api.routes.today import router as today_router
from app.api.routes.transactions import router as transactions_router
from app.config import Settings
from app.database import create_engine_from_settings, create_session_maker, init_database
from app.services.decisioning import CoreCliDecisionEngineAdapter


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    engine = create_engine_from_settings(resolved_settings)
    session_maker = create_session_maker(engine)
    init_database(engine)

    app = FastAPI(
        title="MoneyPulse API",
        version="0.2.0",
        summary="Backend foundation for MoneyPulse decision intelligence.",
    )
    app.state.settings = resolved_settings
    app.state.session_maker = session_maker
    app.state.decision_adapter = CoreCliDecisionEngineAdapter(resolved_settings)

    app.include_router(health_router)
    app.include_router(accounts_router)
    app.include_router(transactions_router)
    app.include_router(goals_router)
    app.include_router(today_router)
    app.include_router(before_you_buy_router)

    return app


app = create_app()
