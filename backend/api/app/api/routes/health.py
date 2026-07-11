from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

router = APIRouter(tags=["health"])


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "service": "moneypulse-api"}


@router.get("/api/health")
async def vercel_healthcheck() -> dict[str, bool]:
    return {"ok": True}


@router.get("/ready")
async def readiness(request: Request) -> JSONResponse:
    session = request.app.state.session_maker()

    try:
        session.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "checks": {"database": "error"},
            },
        )
    finally:
        session.close()

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "status": "ready",
            "checks": {"database": "ok"},
        },
    )
