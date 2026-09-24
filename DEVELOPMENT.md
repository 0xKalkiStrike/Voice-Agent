# AURA Development & Architecture Guide

## Repository Structure

```
aura/
├── frontend/ (src/)
│   ├── components/       # UI Components (Orb, ActivityFeed, Panels, PermissionBar)
│   ├── hooks/            # useAura custom hook (WebSocket + REST integration)
│   ├── lib/              # Client utilities & offline fallback tools
│   └── types/            # TypeScript interface definitions
├── backend/
│   ├── main.py           # FastAPI app & WebSocket handlers
│   ├── config.py         # Settings & environment variables
│   ├── db/               # Atomic JSON Database persistence engine
│   ├── amd/              # AMD ROCm hardware diagnostic engine
│   ├── agent/            # Agent Brain & multi-step execution loop
│   ├── tools/            # Dynamic Tool Registry (13 built-in tools)
│   ├── rag/              # Document Intelligence & embedding pipeline
│   ├── memory/           # Conversation & user memory management
│   ├── security/         # Safety, sanitization, and permission enforcement
│   ├── metrics/          # Performance monitoring & benchmark engine
│   └── tests/            # Python unit & integration test suite
├── data/                 # JSON File Persistence Storage Directory
├── scripts/              # Startup scripts for Windows & Linux
└── docs/                 # Architectural specifications & guides
```

## Local Development Workflow

1. Start Python backend in reload mode:
   ```bash
   python -m uvicorn backend.main:app --reload --port 8000
   ```
2. Start Vite frontend dev server:
   ```bash
   npm run dev
   ```
3. Run Python unit tests:
   ```bash
   python -m unittest discover backend/tests
   ```
4. Run Frontend vitest tests:
   ```bash
   npx vitest run
   ```
