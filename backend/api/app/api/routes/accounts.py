from fastapi import APIRouter, Depends, status

from app.dependencies import get_account_service, get_demo_user_id
from app.schemas.accounts import AccountCreate, AccountRead, AccountUpdate
from app.services.accounts import AccountService

router = APIRouter(tags=["accounts"])


@router.get("/accounts", response_model=list[AccountRead])
async def list_accounts(
    service: AccountService = Depends(get_account_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> list[AccountRead]:
    return [AccountRead.model_validate(account) for account in service.list_accounts(demo_user_id)]


@router.post("/accounts", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate,
    service: AccountService = Depends(get_account_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> AccountRead:
    account = service.create_account(demo_user_id, payload)
    return AccountRead.model_validate(account)


@router.put("/accounts/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: int,
    payload: AccountUpdate,
    service: AccountService = Depends(get_account_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> AccountRead:
    account = service.update_account(demo_user_id, account_id, payload)
    return AccountRead.model_validate(account)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    service: AccountService = Depends(get_account_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> None:
    service.delete_account(demo_user_id, account_id)
