from fastapi import APIRouter
from pydantic import BaseModel

from app.db import load_files, save_files

router = APIRouter()


class SaveFilesRequest(BaseModel):
    project_id: str
    files: dict[str, str]


@router.get("/files")
async def get_files(project_id: str):
    return await load_files(project_id)


@router.post("/files")
async def post_files(body: SaveFilesRequest):
    await save_files(body.project_id, body.files)
    return {"ok": True}
