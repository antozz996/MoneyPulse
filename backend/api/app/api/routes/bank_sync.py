from fastapi import APIRouter, Depends, status

from app.dependencies import get_bank_sync_service, get_current_user
from app.models import UserModel
from app.schemas.bank_sync import (
    BankConnectCompleteCreate,
    BankConnectStartCreate,
    BankConnectStartRead,
    BankConnectionRead,
    BankSyncCreate,
    BankSyncRead,
)
from app.services.bank_sync import BankSyncService

router = APIRouter(tags=["bank-sync"])


@router.post(
    "/bank/connect/start",
    response_model=BankConnectStartRead,
    status_code=status.HTTP_201_CREATED,
)
async def start_bank_connection(
    payload: BankConnectStartCreate,
    service: BankSyncService = Depends(get_bank_sync_service),
    current_user: UserModel = Depends(get_current_user),
) -> BankConnectStartRead:
    return service.start_connection(current_user.id, payload)


@router.post("/bank/connect/complete", response_model=BankConnectionRead)
async def complete_bank_connection(
    payload: BankConnectCompleteCreate,
    service: BankSyncService = Depends(get_bank_sync_service),
    current_user: UserModel = Depends(get_current_user),
) -> BankConnectionRead:
    return service.complete_connection(current_user.id, payload)


@router.get("/bank/connections", response_model=list[BankConnectionRead])
async def list_bank_connections(
    service: BankSyncService = Depends(get_bank_sync_service),
    current_user: UserModel = Depends(get_current_user),
) -> list[BankConnectionRead]:
    return service.list_connections(current_user.id)


@router.delete("/bank/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_connection(
    connection_id: int,
    service: BankSyncService = Depends(get_bank_sync_service),
    current_user: UserModel = Depends(get_current_user),
) -> None:
    service.delete_connection(current_user.id, connection_id)


@router.post("/bank/sync", response_model=BankSyncRead)
async def sync_bank_connections(
    payload: BankSyncCreate,
    service: BankSyncService = Depends(get_bank_sync_service),
    current_user: UserModel = Depends(get_current_user),
) -> BankSyncRead:
    return service.sync(current_user.id, payload)
