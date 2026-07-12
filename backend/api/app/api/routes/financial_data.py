from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_financial_data_service
from app.models import UserModel
from app.schemas.accounts import AccountRead
from app.schemas.bank_sync import BankConnectionRead
from app.schemas.budgets import BudgetRead
from app.schemas.financial_data import (
    CategoryRead,
    FinancialDataRead,
    FinancialProfileRead,
    FinancialProfileUpdate,
)
from app.schemas.goals import GoalRead
from app.schemas.recurring_events import RecurringEventRead
from app.schemas.transactions import TransactionRead
from app.services.financial_data import FinancialDataService

router = APIRouter(tags=["financial-data"])


@router.get("/financial-data", response_model=FinancialDataRead)
async def get_financial_data(
    service: FinancialDataService = Depends(get_financial_data_service),
    current_user: UserModel = Depends(get_current_user),
) -> FinancialDataRead:
    payload = service.load_financial_data(current_user.id)
    return FinancialDataRead(
        mode="api",
        financial_profile=FinancialProfileRead.model_validate(payload["financial_profile"]),
        categories=[
            CategoryRead.model_validate(category) for category in payload["categories"]
        ],
        budgets=[BudgetRead.model_validate(budget) for budget in payload["budgets"]],
        accounts=[AccountRead.model_validate(account) for account in payload["accounts"]],
        transactions=[
            TransactionRead.model_validate(transaction)
            for transaction in payload["transactions"]
        ],
        recurring_events=[
            RecurringEventRead.model_validate(recurring_event)
            for recurring_event in payload["recurring_events"]
        ],
        goals=[GoalRead.model_validate(goal) for goal in payload["goals"]],
        bank_connections=[
            BankConnectionRead.model_validate(connection)
            for connection in payload["bank_connections"]
        ],
    )


@router.get("/financial-profile", response_model=FinancialProfileRead)
async def get_financial_profile(
    service: FinancialDataService = Depends(get_financial_data_service),
    current_user: UserModel = Depends(get_current_user),
) -> FinancialProfileRead:
    profile = service.get_or_create_profile(current_user.id)
    return FinancialProfileRead.model_validate(profile)


@router.put("/financial-profile", response_model=FinancialProfileRead)
async def update_financial_profile(
    payload: FinancialProfileUpdate,
    service: FinancialDataService = Depends(get_financial_data_service),
    current_user: UserModel = Depends(get_current_user),
) -> FinancialProfileRead:
    profile = service.update_profile(current_user.id, payload)
    return FinancialProfileRead.model_validate(profile)


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(
    service: FinancialDataService = Depends(get_financial_data_service),
    current_user: UserModel = Depends(get_current_user),
) -> list[CategoryRead]:
    return [
        CategoryRead.model_validate(category)
        for category in service.list_categories(current_user.id)
    ]
