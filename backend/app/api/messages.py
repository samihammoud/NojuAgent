from fastapi import APIRouter
from pydantic import BaseModel

from app.db import append_message, load_messages

router = APIRouter()


class AppendMessageRequest(BaseModel):
    role: str
    content: str | list


@router.get("/projects/{project_id}/messages")
async def get_messages(project_id: str):
    return await load_messages(project_id)


@router.post("/projects/{project_id}/messages")
async def post_message(project_id: str, body: AppendMessageRequest):
    await append_message(project_id, body.role, body.content)
    return {"ok": True}
