from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    message: Message


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    # Placeholder — wire up your agent logic here.
    return ChatResponse(
        message=Message(role="assistant", content="Hello from NojuAgent!")
    )
