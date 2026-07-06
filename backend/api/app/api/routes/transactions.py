from fastapi import APIRouter, Depends, status

from app.dependencies import get_demo_user_id, get_transaction_service
from app.schemas.transactions import TransactionCreate, TransactionRead
from app.services.transactions import TransactionService

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=list[TransactionRead])
async def list_transactions(
    service: TransactionService = Depends(get_transaction_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> list[TransactionRead]:
    return [
        TransactionRead.model_validate(transaction)
        for transaction in service.list_transactions(demo_user_id)
    ]


@router.post(
    "/transactions",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    payload: TransactionCreate,
    service: TransactionService = Depends(get_transaction_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> TransactionRead:
    transaction = service.create_transaction(demo_user_id, payload)
    return TransactionRead.model_validate(transaction)
