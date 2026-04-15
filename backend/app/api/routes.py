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

    #TWO DIFFERENT DIRECTIONS
    #passed as a callable function to agent, so agent can call over websocket to frontend in agent.py

    async def send(msg: dict) -> None:
        try:
            await ws.send_json(msg)
        except Exception:
            pass
    ##FUTURE: Rewrite Send to forward tools to database instead of browser, and write to webContainer on fileWrites only

    async def run_agent(content: str) -> None:
        try:
            await session.run(content, send)
        except Exception as exc:
            logger.exception("Agent error")
            await send({"type": "error", "message": str(exc)})


        #websocket is either receiving a user message or a tool response. If a user message, we start an agent session.
        #looping because always waiting
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
                #need to run async so that it doesn't block the websocket from receiving tool results
                #two loops running on same thread
                current_task = asyncio.create_task(run_agent(content))

                #although agent makes the call to webcontainer, the response is sent to websocket's tool result.
                #return future promise, resume agent loop internally
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
