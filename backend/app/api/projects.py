from fastapi import APIRouter
from pydantic import BaseModel

from app.db import create_project, list_projects, upsert_user

router = APIRouter()


class CreateProjectRequest(BaseModel):
    user_id: str
    name: str = "My App"


@router.get("/projects")
async def get_projects(user_id: str):
    return await list_projects(user_id)


@router.post("/projects")
async def post_project(body: CreateProjectRequest):
    await upsert_user(body.user_id)
    project_id = await create_project(body.user_id, body.name)
    return {"project_id": project_id}
