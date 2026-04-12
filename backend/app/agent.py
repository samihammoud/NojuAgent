import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

import anthropic

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Noju, an expert web-building assistant. You help users build and \
modify web applications that run in a browser-based virtual filesystem.

The virtual filesystem runs a simple Node.js HTTP server (server.js) that serves index.html \
on every request. Build apps by writing self-contained HTML files with inline CSS and JavaScript.

You have three tools:
- list_files: List files in a directory
- read_file: Read a file's contents
- write_file: Write content to a file (creates or overwrites)

Rules:
1. Always read index.html before modifying it — never write without reading first
2. Write complete, self-contained HTML files with inline <style> and <script> tags
3. Use only vanilla JS — no npm packages, no imports from CDNs
4. Keep your final reply brief — one or two sentences explaining what you built/changed"""

TOOLS: list[dict] = [
    {
        "name": "list_files",
        "description": "List all files in a directory of the virtual filesystem",
        "input_schema": {
            "type": "object",
            "properties": {
                "dir": {"type": "string", "description": "Directory to list, e.g. '.'"}
            },
            "required": ["dir"],
        },
    },
    {
        "name": "read_file",
        "description": "Read the full contents of a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path, e.g. 'index.html'"}
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "Write content to a file, creating or overwriting it",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path, e.g. 'index.html'"},
                "content": {"type": "string", "description": "Full file content to write"},
            },
            "required": ["path", "content"],
        },
    },
]

SendFn = Callable[[dict], Awaitable[None]]


class AgentSession:
    """One ReAct session per WebSocket connection — holds conversation history."""

    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        self.client = client
        self.messages: list[dict] = []
        self._pending: dict[str, asyncio.Future[str]] = {}

    def deliver_tool_result(self, tool_use_id: str, result: str) -> None:
        future = self._pending.pop(tool_use_id, None)
        if future and not future.done():
            future.set_result(result)

    async def _call_tool(
        self, send: SendFn, tool_use_id: str, tool: str, args: dict
    ) -> str:
        loop = asyncio.get_event_loop()
        future: asyncio.Future[str] = loop.create_future()
        self._pending[tool_use_id] = future

        await send(
            {
                "type": "tool_call",
                "tool_use_id": tool_use_id,
                "tool": tool,
                "arguments": args,
            }
        )

        try:
            return await asyncio.wait_for(future, timeout=30.0)
        except asyncio.TimeoutError:
            self._pending.pop(tool_use_id, None)
            return json.dumps({"error": "Tool execution timed out"})

    async def run(self, user_message: str, send: SendFn) -> None:
        """Run the ReAct loop for one user turn."""
        self.messages.append({"role": "user", "content": user_message})

        while True:
            response = await self.client.messages.create(
                model="claude-opus-4-6",
                max_tokens=8096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,  # type: ignore[arg-type]
                messages=self.messages,
            )

            # Build structured assistant content for history
            assistant_content: list[dict] = []
            for block in response.content:
                if block.type == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif block.type == "tool_use":
                    assistant_content.append(
                        {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )

            self.messages.append({"role": "assistant", "content": assistant_content})

            if response.stop_reason == "end_turn":
                final_text = next(
                    (b.text for b in response.content if b.type == "text" and b.text),
                    "Done.",
                )
                await send({"type": "assistant_message", "content": final_text})
                break

            if response.stop_reason == "tool_use":
                tool_results: list[dict] = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue
                    result = await self._call_tool(
                        send, block.id, block.name, block.input
                    )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        }
                    )
                self.messages.append({"role": "user", "content": tool_results})
            else:
                # Unexpected stop — emit any text and bail
                final_text = next(
                    (b.text for b in response.content if b.type == "text" and b.text),
                    "Done.",
                )
                await send({"type": "assistant_message", "content": final_text})
                break
