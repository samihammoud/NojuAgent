import asyncio
import logging
import os

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agent import AgentSession

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter()

_client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()

    session = AgentSession(_client)
    current_task: asyncio.Task | None = None

    async def send(msg: dict) -> None:
        try:
            await ws.send_json(msg)
        except Exception:
            pass

    async def run_agent(content: str) -> None:
        try:
            await session.run(content, send)
        except Exception as exc:
            logger.exception("Agent error")
            await send({"type": "error", "message": str(exc)})

    try:
        while True:
            raw = await ws.receive_json()
            msg_type = raw.get("type")

            if msg_type == "user_message":
                content = raw.get("content", "").strip()
                if not content:
                    continue
                # Cancel any in-flight agent task before starting a new one
                if current_task and not current_task.done():
                    current_task.cancel()
                current_task = asyncio.create_task(run_agent(content))

            elif msg_type == "tool_result":
                session.deliver_tool_result(
                    raw.get("tool_use_id", ""),
                    raw.get("result", ""),
                )

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        if current_task and not current_task.done():
            current_task.cancel()
