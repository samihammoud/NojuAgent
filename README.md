# NojuAgent

Monorepo with a Next.js UI and FastAPI backend.

```
NojuAgent/
├── ui/          # Vite + React + TypeScript
└── backend/     # FastAPI + Python 3.11+
```

## Quick start

### UI

```bash
cd ui
npm install
npm run dev       # http://localhost:3000
```

### Backend

```bash
cd backend
cp .env.example .env   # add your ANTHROPIC_API_KEY
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000
```

### Both at once (from root)

```bash
npm install
npm run dev
```

> Requires `concurrently` at the root and the backend venv already activated.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/chat` | Send a chat message |

The UI proxies `/api/*` to `http://localhost:8000` via `next.config.ts`.
