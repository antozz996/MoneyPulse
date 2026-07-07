from fastapi import APIRouter, Depends, status

from app.dependencies import get_checkpoint_service, get_demo_user_id
from app.schemas.checkpoints import CheckpointCreate, CheckpointRead, CheckpointUpdate
from app.services.checkpoints import CheckpointService

router = APIRouter(tags=["checkpoints"])


@router.get("/checkpoints", response_model=list[CheckpointRead])
async def list_checkpoints(
    service: CheckpointService = Depends(get_checkpoint_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> list[CheckpointRead]:
    return [
        CheckpointRead.model_validate(checkpoint)
        for checkpoint in service.list_checkpoints(demo_user_id)
    ]


@router.post(
    "/checkpoints",
    response_model=CheckpointRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkpoint(
    payload: CheckpointCreate,
    service: CheckpointService = Depends(get_checkpoint_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> CheckpointRead:
    checkpoint = service.create_checkpoint(demo_user_id, payload)
    return CheckpointRead.model_validate(checkpoint)


@router.put("/checkpoints/{checkpoint_id}", response_model=CheckpointRead)
async def update_checkpoint(
    checkpoint_id: int,
    payload: CheckpointUpdate,
    service: CheckpointService = Depends(get_checkpoint_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> CheckpointRead:
    checkpoint = service.update_checkpoint(demo_user_id, checkpoint_id, payload)
    return CheckpointRead.model_validate(checkpoint)


@router.delete("/checkpoints/{checkpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checkpoint(
    checkpoint_id: int,
    service: CheckpointService = Depends(get_checkpoint_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> None:
    service.delete_checkpoint(demo_user_id, checkpoint_id)
