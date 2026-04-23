# Noju — Claude Code Guide

## What is this?
Noju is a Lovable-style AI web-builder. Users describe what they want; a Claude agent generates/edits React code that runs live in the browser via WebContainers.

## Architecture

```
ui/ (React + Vite, port 3000)
  └─ useAgent.ts       WebSocket hook — sends messages, dispatches tool calls to WebContainer, persists files
  └─ webcontainerTools.ts  Executes list_files / read_file / write_file / run_command inside WebContainer
  └─ previewFiles.ts   Initial virtual filesystem seeded into WebContainer on load

backend/ (FastAPI + Python, port 8000)
  └─ app/agent.py      AgentSession — ReAct loop over claude-haiku-4-5, suspends on tool calls via asyncio.Future
  └─ app/api/ws.py     WebSocket endpoint /api/ws — routes user_message → agent, tool_result → Future
  └─ app/api/projects.py  REST: GET/POST /api/projects
  └─ app/api/files.py  REST: GET/POST /api/files — load and save project files
  └─ app/db.py         Supabase client — users, projects, files tables
  └─ app/main.py       FastAPI app, CORS, router registration
```

### WebSocket message flow
1. Frontend sends `{ type: "user_message", content }` → backend creates `asyncio.Task` for `session.run()`
2. Agent calls a tool → backend sends `{ type: "tool_call", tool_use_id, tool, arguments }` to frontend
3. Frontend executes tool in WebContainer → sends `{ type: "tool_result", tool_use_id, result }` back
4. Backend resolves the `asyncio.Future`, agent loop continues
5. Agent finishes → backend sends `{ type: "turn_complete", content }`
6. Frontend receives `turn_complete` → POSTs all current files to `POST /api/files`

### File persistence flow
- **On project load:** frontend calls `GET /api/files?project_id=...` → mounts returned files into WebContainer
- **During agent turn:** `write_file` tool calls execute immediately in WebContainer (agent loop unblocked)
- **After turn_complete:** frontend POSTs snapshot of all open files to `POST /api/files` → Supabase upsert
- The WebSocket is not involved in file persistence at all

## Running locally

```bash
# From repo root — starts both servers with concurrently
npm run dev

# Or individually:
npm run ui          # Vite dev server on :3000
npm run backend     # uvicorn on :8000 (uses uv)
```

## Environment variables

**backend/.env** (required):
```
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

**ui/.env** (required):
```
VITE_CLERK_PUBLISHABLE_KEY=...
```

## Key design decisions

- **Tool calls bridge two runtimes.** The agent (Python) cannot touch the browser filesystem directly. It sends tool calls over WebSocket; the frontend executes them in WebContainer and returns results. The asyncio.Future in `AgentSession._pending` suspends the Python coroutine while waiting.
- **One AgentSession per WebSocket connection.** Conversation history (`self.messages`) lives in memory for the lifetime of the connection. Re-connecting starts a fresh session.
- **File persistence is frontend-owned.** The WebSocket has no knowledge of the DB. On `turn_complete`, the frontend POSTs its full `openFiles` snapshot to `POST /api/files`. On mount, it fetches `GET /api/files` and seeds WebContainer. This keeps the WebSocket handler stateless with respect to storage.
- **Auth via Clerk.** The frontend uses Clerk for auth. The `user_id` (Clerk user ID) is passed as a query param on the WebSocket URL and on REST calls; backend upserts it into Supabase on first project creation.

## Database schema (Supabase)

| Table | Key columns |
|-------|-------------|
| `users` | `id` (Clerk user ID), `email` |
| `projects` | `id` (UUID, generated), `user_id`, `name`, `created_at` |
| `files` | `project_id`, `path`, `content` — unique on `(project_id, path)` |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Clerk |
| In-browser runtime | `@webcontainer/api` |
| Backend | FastAPI, Python 3.11+, uvicorn |
| AI | Anthropic `claude-opus-4-6` |
| Database | Supabase (Postgres) |
| Package manager | npm workspaces (frontend), uv (backend) |
