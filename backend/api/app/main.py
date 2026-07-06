from fastapi import FastAPI

from app.api.routes.decision import router as decision_router
from app.api.routes.health import router as health_router


app = FastAPI(
    title="MoneyPulse API",
    version="0.1.0",
    summary="Decision intelligence API scaffold for personal finance.",
)

app.include_router(health_router)
app.include_router(decision_router)

