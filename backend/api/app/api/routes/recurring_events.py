from fastapi import APIRouter, Depends, status

from app.dependencies import get_demo_user_id, get_recurring_event_service
from app.schemas.recurring_events import (
    RecurringEventCreate,
    RecurringEventRead,
    RecurringEventUpdate,
)
from app.services.recurring_events import RecurringEventService

router = APIRouter(tags=["recurring-events"])


@router.get("/recurring-events", response_model=list[RecurringEventRead])
async def list_recurring_events(
    service: RecurringEventService = Depends(get_recurring_event_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> list[RecurringEventRead]:
    return [
        RecurringEventRead.model_validate(recurring_event)
        for recurring_event in service.list_recurring_events(demo_user_id)
    ]


@router.post(
    "/recurring-events",
    response_model=RecurringEventRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_recurring_event(
    payload: RecurringEventCreate,
    service: RecurringEventService = Depends(get_recurring_event_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> RecurringEventRead:
    recurring_event = service.create_recurring_event(demo_user_id, payload)
    return RecurringEventRead.model_validate(recurring_event)


@router.put("/recurring-events/{recurring_event_id}", response_model=RecurringEventRead)
async def update_recurring_event(
    recurring_event_id: int,
    payload: RecurringEventUpdate,
    service: RecurringEventService = Depends(get_recurring_event_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> RecurringEventRead:
    recurring_event = service.update_recurring_event(
        demo_user_id,
        recurring_event_id,
        payload,
    )
    return RecurringEventRead.model_validate(recurring_event)


@router.delete(
    "/recurring-events/{recurring_event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_recurring_event(
    recurring_event_id: int,
    service: RecurringEventService = Depends(get_recurring_event_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> None:
    service.delete_recurring_event(demo_user_id, recurring_event_id)
