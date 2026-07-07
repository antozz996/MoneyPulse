from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_transaction_service
from app.models import UserModel
from app.schemas.transactions import TransactionCreate, TransactionRead, TransactionUpdate
from app.services.transactions import TransactionService

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=list[TransactionRead])
async def list_transactions(
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> list[TransactionRead]:
    return [
        TransactionRead.model_validate(transaction)
        for transaction in service.list_transactions(current_user.id)
    ]


@router.post(
    "/transactions",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    payload: TransactionCreate,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionRead:
    transaction = service.create_transaction(current_user.id, payload)
    return TransactionRead.model_validate(transaction)


@router.put("/transactions/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionRead:
    transaction = service.update_transaction(current_user.id, transaction_id, payload)
    return TransactionRead.model_validate(transaction)


@router.delete(
    "/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_transaction(
    transaction_id: int,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> None:
    service.delete_transaction(current_user.id, transaction_id)
