from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_recurring_event_service
from app.models import UserModel
from app.schemas.recurring_events import (
    RecurringEventCreate,
    RecurringEventRead,
    RecurringEventUpdate,
)
from app.services.recurring_events import RecurringEventService

router = APIRouter(tags=["recurring-events"])


@router.get("/recurring-items", response_model=list[RecurringEventRead])
@router.get("/recurring-events", response_model=list[RecurringEventRead])
async def list_recurring_events(
    service: RecurringEventService = Depends(get_recurring_event_service),
    current_user: UserModel = Depends(get_current_user),
) -> list[RecurringEventRead]:
    return [
        RecurringEventRead.model_validate(recurring_event)
        for recurring_event in service.list_recurring_events(current_user.id)
    ]


@router.post(
    "/recurring-items",
    response_model=RecurringEventRead,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/recurring-events",
    response_model=RecurringEventRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_recurring_event(
    payload: RecurringEventCreate,
    service: RecurringEventService = Depends(get_recurring_event_service),
    current_user: UserModel = Depends(get_current_user),
) -> RecurringEventRead:
    recurring_event = service.create_recurring_event(current_user.id, payload)
    return RecurringEventRead.model_validate(recurring_event)


@router.patch("/recurring-items/{recurring_event_id}", response_model=RecurringEventRead)
@router.patch("/recurring-events/{recurring_event_id}", response_model=RecurringEventRead)
async def update_recurring_event(
    recurring_event_id: int,
    payload: RecurringEventUpdate,
    service: RecurringEventService = Depends(get_recurring_event_service),
    current_user: UserModel = Depends(get_current_user),
) -> RecurringEventRead:
    recurring_event = service.update_recurring_event(
        current_user.id,
        recurring_event_id,
        payload,
    )
    return RecurringEventRead.model_validate(recurring_event)


@router.put("/recurring-items/{recurring_event_id}", response_model=RecurringEventRead)
@router.put("/recurring-events/{recurring_event_id}", response_model=RecurringEventRead)
async def replace_recurring_event(
    recurring_event_id: int,
    payload: RecurringEventCreate,
    service: RecurringEventService = Depends(get_recurring_event_service),
    current_user: UserModel = Depends(get_current_user),
) -> RecurringEventRead:
    recurring_event = service.update_recurring_event(
        current_user.id,
        recurring_event_id,
        RecurringEventUpdate(**payload.model_dump()),
    )
    return RecurringEventRead.model_validate(recurring_event)


@router.delete(
    "/recurring-items/{recurring_event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@router.delete(
    "/recurring-events/{recurring_event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_recurring_event(
    recurring_event_id: int,
    service: RecurringEventService = Depends(get_recurring_event_service),
    current_user: UserModel = Depends(get_current_user),
) -> None:
    service.delete_recurring_event(current_user.id, recurring_event_id)
