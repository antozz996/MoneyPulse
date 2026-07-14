from datetime import date

from fastapi import APIRouter, Depends, Query, status

from app.dependencies import get_current_user, get_transaction_service
from app.models import UserModel
from app.schemas.transaction_categorization import (
    TransactionCategorizationFeedbackRequest,
    TransactionCategorizationRequest,
    TransactionCategorizationResponse,
    TransactionRecategorizeRequest,
    TransactionRecategorizeResponse,
)
from app.schemas.transactions import (
    TransactionCreate,
    TransactionListResponse,
    TransactionRead,
    TransactionType,
    TransactionUpdate,
)
from app.services.transactions import TransactionService

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    type: TransactionType | None = Query(default=None),
    account_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionListResponse:
    return service.list_transactions(
        current_user.id,
        date_from=date_from,
        date_to=date_to,
        transaction_type=type,
        account_id=account_id,
        category_id=category_id,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/transactions/categorize",
    response_model=TransactionCategorizationResponse,
)
async def categorize_transactions(
    payload: TransactionCategorizationRequest,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionCategorizationResponse:
    return service.categorize_transactions(current_user.id, payload)


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
    return TransactionRead.model_validate(transaction, from_attributes=True)


@router.patch("/transactions/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionRead:
    transaction = service.update_transaction(current_user.id, transaction_id, payload)
    return TransactionRead.model_validate(transaction, from_attributes=True)


@router.put("/transactions/{transaction_id}", response_model=TransactionRead)
async def replace_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionRead:
    transaction = service.update_transaction(current_user.id, transaction_id, payload)
    return TransactionRead.model_validate(transaction, from_attributes=True)


@router.post(
    "/transactions/{transaction_id}/categorization-feedback",
    response_model=TransactionRead,
)
async def record_transaction_categorization_feedback(
    transaction_id: int,
    payload: TransactionCategorizationFeedbackRequest,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionRead:
    transaction = service.record_categorization_feedback(
        current_user.id,
        transaction_id,
        payload,
    )
    return TransactionRead.model_validate(transaction, from_attributes=True)


@router.post(
    "/transactions/recategorize",
    response_model=TransactionRecategorizeResponse,
)
async def recategorize_transactions(
    payload: TransactionRecategorizeRequest,
    service: TransactionService = Depends(get_transaction_service),
    current_user: UserModel = Depends(get_current_user),
) -> TransactionRecategorizeResponse:
    return service.recategorize_transactions(current_user.id, payload)


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
