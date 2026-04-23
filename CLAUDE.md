# Noju — Claude Code Guide

## What is this?
Noju is a Lovable-style AI web-builder. Users describe what they want; a Claude agent generates/edits React code that runs live in the browser via WebContainers.

## Architecture

```
ui/ (React + Vite, port 3000)
  └─ useAgent.ts       WebSocket hook — sends messages, dispatches tool calls to WebContainer, persists files
                         accepts AgentOptions { initialMessages, onPersist } — calls onPersist on user send and turn_complete
  └─ useMessages.ts    REST hook — loads message history on mount, exposes saveMessage (the onPersist callback)
  └─ webcontainerTools.ts  Executes list_files / read_file / write_file / run_command inside WebContainer
  └─ previewFiles.ts   Initial virtual filesystem seeded into WebContainer on load

backend/ (FastAPI + Python, port 8000)
  └─ app/agent.py      AgentSession — ReAct loop over claude-haiku-4-5, suspends on tool calls via asyncio.Future
  └─ app/context.py    Context window management — compact_messages (stub stale file content), truncate_history (sliding window)
  └─ app/api/ws.py     WebSocket endpoint /api/ws — routes user_message → agent, tool_result → Future
  └─ app/api/projects.py  REST: GET/POST /api/projects
  └─ app/api/files.py  REST: GET/POST /api/files — load and save project files
  └─ app/api/messages.py  REST: GET/POST /api/projects/{project_id}/messages — load and save chat messages
  └─ app/db.py         Supabase client — users, projects, files, messages tables
  └─ app/main.py       FastAPI app, CORS, router registration
```

### WebSocket message flow
1. Frontend sends `{ type: "user_message", content }` → backend creates `asyncio.Task` for `session.run()`
2. Agent calls a tool → backend sends `{ type: "tool_call", tool_use_id, tool, arguments }` to frontend
3. Frontend executes tool in WebContainer → sends `{ type: "tool_result", tool_use_id, result }` back
4. Backend resolves the `asyncio.Future`, agent loop continues
5. Agent finishes → backend sends `{ type: "turn_complete", content }`
6. Frontend receives `turn_complete` → POSTs all current files to `POST /api/files` and assistant message to `POST /api/projects/{id}/messages`

### File persistence flow
- **On project load:** frontend calls `GET /api/files?project_id=...` → mounts returned files into WebContainer
- **During agent turn:** `write_file` tool calls execute immediately in WebContainer (agent loop unblocked)
- **After turn_complete:** frontend POSTs snapshot of all open files to `POST /api/files` → Supabase upsert
- The WebSocket is not involved in file persistence at all

### Message persistence flow
- **On project load:** `useMessages(projectId)` fetches `GET /api/projects/{id}/messages` → seeds `initialMessages`
- `App.tsx` gates on `useMessages.loaded` before rendering the workspace, so `useAgent` always receives the full history as its initial state
- `useMessages.saveMessage` is passed to `useAgent` as the `onPersist` callback — `useAgent` has no knowledge of the REST layer
- **On user send:** `useAgent.sendMessage` calls `onPersist("user", content)` → POST to messages API
- **On turn_complete:** `useAgent` calls `onPersist("assistant", content)` → POST to messages API

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
- **One AgentSession per WebSocket connection.** Conversation history (`self.messages`) lives in memory for the lifetime of the connection. Re-connecting starts a fresh session. Message history for continuity is loaded from the DB by the frontend and passed as `initialMessages` to `useAgent`.
- **File persistence is frontend-owned.** The WebSocket has no knowledge of the DB. On `turn_complete`, the frontend POSTs its full `openFiles` snapshot to `POST /api/files`. On mount, it fetches `GET /api/files` and seeds WebContainer. This keeps the WebSocket handler stateless with respect to storage.
- **Message persistence uses a callback seam.** `useAgent` calls `onPersist(role, content)` at the right moments but has no knowledge of the REST API. `useMessages` owns the fetch logic and passes `saveMessage` as the callback. They are composed in `App.tsx` via the `Workspace` component.
- **Auth via Clerk.** The frontend uses Clerk for auth. The `user_id` (Clerk user ID) is passed as a query param on the WebSocket URL and on REST calls; backend upserts it into Supabase on first project creation.
- **Context window management.** Before every Anthropic API call in the ReAct loop, `agent.py` runs `compact_messages` and `truncate_history` from [backend/app/context.py](backend/app/context.py):
  - `compact_messages` — walks history newest → oldest; for each file path, the first (= latest) `read_file` result or `write_file` input is kept, all older ones have their content replaced with `"<superseded>"`. Preserves tool_use_id pairings so the API doesn't reject orphaned blocks.
  - `truncate_history` — caps `self.messages` at `MAX_MESSAGES = 30`. Only cuts at plain-text user messages (turn boundaries) to avoid orphaning a `tool_result` from its `tool_use`.
- **Dynamic system prompt with file tree.** `AgentSession` takes a `project_id` at construction. Before each API call, it runs `db.list_paths(project_id)` and appends `## Current project files\n- path1\n- path2 ...` to `SYSTEM_PROMPT_BASE`. This removes the "always call list_files first" rule — the agent already has the tree. `list_files` remains as a fallback tool. The tree is sourced from Supabase (stale within a turn since writes only persist on `turn_complete`), but the agent's own tool_use history covers files it created in the current turn.
- **Debug logging.** Each API call's payload and response are appended as JSON to `backend/agent_debug.log` (line-buffered append). Watch `input_tokens` growth across turns to verify compaction — `<superseded>` markers in the payload confirm stale file content was stubbed.

## Database schema (Supabase)

| Table | Key columns |
|-------|-------------|
| `users` | `id` (Clerk user ID), `email` |
| `projects` | `id` (UUID, generated), `user_id`, `name`, `created_at` |
| `files` | `project_id`, `path`, `content` — unique on `(project_id, path)` |
| `messages` | `id` (UUID), `project_id`, `role` (user\|assistant), `content` (jsonb), `created_at` — indexed on `(project_id, created_at)` |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Clerk |
| In-browser runtime | `@webcontainer/api` |
| Backend | FastAPI, Python 3.11+, uvicorn |
| AI | Anthropic `claude-opus-4-6` |
| Database | Supabase (Postgres) |
| Package manager | npm workspaces (frontend), uv (backend) |
