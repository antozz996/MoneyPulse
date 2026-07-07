from fastapi import APIRouter, Depends, status

from app.dependencies import get_auth_service, get_current_user
from app.models import UserModel
from app.schemas.auth import AuthSessionRead, LoginCreate, RegisterUserCreate
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthSessionRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterUserCreate,
    service: AuthService = Depends(get_auth_service),
) -> AuthSessionRead:
    return service.register(payload)


@router.post("/login", response_model=AuthSessionRead)
async def login(
    payload: LoginCreate,
    service: AuthService = Depends(get_auth_service),
) -> AuthSessionRead:
    return service.login(payload)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_: UserModel = Depends(get_current_user)) -> None:
    return None
