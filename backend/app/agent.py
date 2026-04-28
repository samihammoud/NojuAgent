import asyncio
import json
import logging
from collections.abc import Awaitable, Callable

import anthropic

from app.context import compact_messages, truncate_history
from app.db import list_paths

logger = logging.getLogger(__name__)

_log = open("agent_debug.log", "a", buffering=1)

SYSTEM_PROMPT_BASE = """You are Noju, an expert web-building assistant. You help users build and \
modify React web applications that run in a browser-based virtual filesystem powered by Vite.

The project is a Vite + React app. The entry point is index.html → src/main.jsx → src/App.jsx.
Vite serves the app on port 3000 with hot module replacement — changes to files are reflected \
in the browser immediately without a full reload.

You have four tools:
- list_files: List files in a directory (only call if the project files section below seems stale)
- read_file: Read a file's contents
- write_file: Write content to a file (creates or overwrites)
- run_command: Run pnpm commands (e.g. pnpm add chart.js)

Rules:
1. Always read a file before writing it — never overwrite without reading first
2. Place React components in src/components/, pages in src/pages/
3. Use .jsx extension for all React component files
4. Use relative imports between files (e.g. import Button from './components/Button.jsx')
5. CRITICAL: Before importing ANY external package (e.g. lucide-react, chart.js, axios), you MUST run pnpm add <package-name> first — no package is pre-installed except react and react-dom
6. Do not use CDN imports — install packages via pnpm instead
7. Keep individual files under 300 lines — extract sub-components when files grow large
8. Keep your final reply brief — one or two sentences explaining what you built/changed
9. NEVER tell the user to run commands manually — always use the run_command tool instead
10. NEVER tell the user to run pnpm run dev — the dev server is already running in WebContainer and hot-reloads automatically
11. CRITICAL: If you write a file that imports from another local file, you MUST write all imported files in the same turn — never leave imports pointing at files that do not exist"""


def _render_tree(paths: list[str]) -> str:
    if not paths:
        return "(empty project — no files yet)"
    return "\n".join(f"- {p}" for p in paths)

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
        "description": "Run a terminal command in the project (pnpm add <pkg>, pnpm run build, etc.)",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Command to run, e.g. 'pnpm add chart.js' or 'pnpm run build'",
                }
            },
            "required": ["command"],
        },
    },
]

MAX_MESSAGES = 30
MAX_ITERATIONS = 25

SendFn = Callable[[dict], Awaitable[None]]


class AgentSession:
    """One ReAct session per WebSocket connection — holds conversation history."""

    def __init__(self, client: anthropic.AsyncAnthropic, project_id: str) -> None:
        self.client = client
        self.project_id = project_id
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
    
        "append FS to system prompt beginning each turn"
        paths = await list_paths(self.project_id)
        system_prompt = SYSTEM_PROMPT_BASE + f"\n\n## Current project files\n{_render_tree(paths)}"

        iterations = 0
        while True:
            iterations += 1
            if iterations > MAX_ITERATIONS:
                await send({
                    "type": "turn_complete",
                    "content": f"Hit iteration cap ({MAX_ITERATIONS} tool calls). Let me know how you'd like to proceed.",
                })
                break
            compact_messages(self.messages)
            truncate_history(self.messages, MAX_MESSAGES)
            payload = {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 16000,
                "system": system_prompt,
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
