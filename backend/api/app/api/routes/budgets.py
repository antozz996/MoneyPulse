from fastapi import APIRouter, Depends, status

from app.dependencies import get_budget_service, get_current_user
from app.models import UserModel
from app.schemas.budgets import BudgetCreate, BudgetRead, BudgetUpdate
from app.services.budgets import BudgetService

router = APIRouter(tags=["budgets"])


@router.get("/budgets", response_model=list[BudgetRead])
async def list_budgets(
    service: BudgetService = Depends(get_budget_service),
    current_user: UserModel = Depends(get_current_user),
) -> list[BudgetRead]:
    return [
        BudgetRead.model_validate(budget) for budget in service.list_budgets(current_user.id)
    ]


@router.post("/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    service: BudgetService = Depends(get_budget_service),
    current_user: UserModel = Depends(get_current_user),
) -> BudgetRead:
    budget = service.create_budget(current_user.id, payload)
    return BudgetRead.model_validate(budget)


@router.patch("/budgets/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: int,
    payload: BudgetUpdate,
    service: BudgetService = Depends(get_budget_service),
    current_user: UserModel = Depends(get_current_user),
) -> BudgetRead:
    budget = service.update_budget(current_user.id, budget_id, payload)
    return BudgetRead.model_validate(budget)


@router.put("/budgets/{budget_id}", response_model=BudgetRead)
async def replace_budget(
    budget_id: int,
    payload: BudgetCreate,
    service: BudgetService = Depends(get_budget_service),
    current_user: UserModel = Depends(get_current_user),
) -> BudgetRead:
    budget = service.update_budget(
        current_user.id,
        budget_id,
        BudgetUpdate(**payload.model_dump()),
    )
    return BudgetRead.model_validate(budget)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    service: BudgetService = Depends(get_budget_service),
    current_user: UserModel = Depends(get_current_user),
) -> None:
    service.delete_budget(current_user.id, budget_id)
