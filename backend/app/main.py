from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import files, messages, projects, ws

app = FastAPI(title="NojuAgent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(ws.router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
