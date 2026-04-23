import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

import anthropic

from app.context import compact_messages, truncate_history

logger = logging.getLogger(__name__)

_log = open("agent_debug.log", "a", buffering=1)

SYSTEM_PROMPT = """You are Noju, an expert web-building assistant. You help users build and \
modify React web applications that run in a browser-based virtual filesystem powered by Vite.

The project is a Vite + React app. The entry point is index.html → src/main.jsx → src/App.jsx.
Vite serves the app on port 3000 with hot module replacement — changes to files are reflected \
in the browser immediately without a full reload.

You have four tools:
- list_files: List files in a directory
- read_file: Read a file's contents
- write_file: Write content to a file (creates or overwrites)
- run_command: Run npm/npx commands (e.g. npm install chart.js)

Rules:
1. Always call list_files first to understand the current project structure
2. Always read a file before writing it — never overwrite without reading first
3. Place React components in src/components/, pages in src/pages/
4. Use .jsx extension for all React component files
5. Use relative imports between files (e.g. import Button from './components/Button.jsx')
6. Before using any npm package, run: npm install <package-name>
7. Do not use CDN imports — install packages via npm instead
8. Keep individual files under 300 lines — extract sub-components when files grow large
9. Keep your final reply brief — one or two sentences explaining what you built/changed"""

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
                "path": {"type": "string", "description": "File path, e.g. 'src/App.jsx'"},
                "content": {"type": "string", "description": "Full file content to write"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "run_command",
        "description": "Run a terminal command in the project (npm install, npm run build, etc.)",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Command to run, e.g. 'npm install chart.js' or 'npm run build'",
                }
            },
            "required": ["command"],
        },
    },
]

MAX_MESSAGES = 30

SendFn = Callable[[dict], Awaitable[None]]


class AgentSession:
    """One ReAct session per WebSocket connection — holds conversation history."""

    def __init__(self, client: anthropic.AsyncAnthropic) -> None:
        self.client = client
        self.messages: list[dict] = []
        self._pending: dict[str, asyncio.Future[str]] = {}

    # this is how continuity is preserved after agent calls tool over websocket
    def deliver_tool_result(self, tool_use_id: str, result: str) -> None:
        future = self._pending.pop(tool_use_id, None)
        if future and not future.done():
            future.set_result(result)



    async def _call_tool(
        self, send: SendFn, tool_use_id: str, tool: str, args: dict
    ) -> str:
        loop = asyncio.get_event_loop()

        #waiting for websocket to execute and resolve future, resumes after future resolved
        #coopoerative waiting on routes.py
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
            return await asyncio.wait_for(future, timeout=120.0)
        except asyncio.TimeoutError:
            self._pending.pop(tool_use_id, None)
            return json.dumps({"error": "Tool execution timed out"})

    async def run(self, user_message: str, send: SendFn) -> None:
        """Run the ReAct loop for one user turn."""
        self.messages.append({"role": "user", "content": user_message})

        while True:
            compact_messages(self.messages)
            truncate_history(self.messages, MAX_MESSAGES)
            payload = {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 16000,
                "system": SYSTEM_PROMPT,
                "tools": TOOLS,
                "messages": self.messages,
            }
            _log.write(json.dumps(payload, indent=2) + "\n")

            response = await self.client.messages.create(**payload)  # type: ignore[arg-type]

            _log.write(json.dumps(response.model_dump(), indent=2) + "\n")

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
                _log.write(json.dumps({"final_assistant_message": final_text}, indent=2) + "\n")
                await send({"type": "turn_complete", "content": final_text})
                break

            #call tool over websocket
            if response.stop_reason == "tool_use":
                tool_results: list[dict] = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue
                    result = await self._call_tool( 
                        send, block.id, block.name, block.input
                    )

                    #essentially waits here per helper funciton
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
                await send({"type": "turn_complete", "content": final_text})
                break
