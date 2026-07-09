from fastapi import APIRouter, Depends

from app.dependencies import get_copilot_service, get_current_user
from app.models import UserModel
from app.schemas.copilot import CopilotChatCreate, CopilotReplyRead
from app.services.copilot import CopilotService

router = APIRouter(tags=["copilot"])


@router.post("/api/copilot/chat", response_model=CopilotReplyRead)
async def chat_with_copilot(
    payload: CopilotChatCreate,
    service: CopilotService = Depends(get_copilot_service),
    current_user: UserModel = Depends(get_current_user),
) -> CopilotReplyRead:
    return service.chat(current_user.id, payload)
