from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_me_service
from app.models import UserModel
from app.schemas.me import UserDataExportRead
from app.services.me import MeService

router = APIRouter(tags=["me"])


@router.get("/me/export", response_model=UserDataExportRead)
async def export_user_data(
    service: MeService = Depends(get_me_service),
    current_user: UserModel = Depends(get_current_user),
) -> UserDataExportRead:
    return service.export_user_data(current_user.id)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_account(
    service: MeService = Depends(get_me_service),
    current_user: UserModel = Depends(get_current_user),
) -> None:
    service.delete_user_account(current_user.id)
