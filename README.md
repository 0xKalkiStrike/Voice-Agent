# AURA — Autonomous Voice Utility & Response Agent

> **Production-Ready Build for the AMD AI Hackathon**

AURA is a local-first, autonomous AI voice agent that can **Listen, Understand, Plan, Reason, Execute Tools, Search Information, Read Documents, Remember Context, Verify Results, and Respond with Voice**.

```
                ┌─────────────────────┐
                │       AURA UI       │
                │ React + TypeScript  │
                └──────────┬──────────┘
                           │
                     WebSocket / API
                           │
                ┌──────────▼──────────┐
                │    FastAPI Server   │
                └──────────┬──────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
  │ Voice Engine │   │ Agent Brain │   │ Memory/RAG  │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         │                 │                 │
  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
  │ STT / TTS   │   │ Tool System │   │ Vector DB   │
  └─────────────┘   └──────┬──────┘   └─────────────┘
                           │
              ┌────────────▼────────────┐
              │ Safe External Services  │
              └─────────────────────────┘
```

---

## Key Features

- **Local-First & Offline Capable**: Your voice and documents stay on your machine.
- **AMD ROCm Acceleration**: Automatically detects AMD Radeon/Instinct GPUs, VRAM, ROCm runtime, and HIP execution capabilities.
- **JSON File Persistence**: Persistent storage for conversations, tasks, projects, memories, documents, settings, and metrics in local JSON files (`data/`).
- **Autonomous Agent Brain**: Multi-step planning, tool selection, parameter validation, permission checks (READ, WRITE, DESTRUCTIVE), and output verification.
- **Document Intelligence (RAG)**: Extract, chunk, embed, and index PDF, DOCX, TXT, and Markdown files with source citations.
- **Dynamic Tool System**: Safe allowlist-based tools (`search_documents`, `read_document`, `summarize_document`, `search_web`, `calculator`, `file_search`, `project_status`, `task_search`, `system_information`, `code_search`, `create_draft`, `calendar_lookup`, `notification`).
- **Real-Time Voice WebSocket**: Real-time event streaming (`/ws/voice`) for voice state transitions, activity timeline, and audio synthesis.

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** & `npm`
- (Optional for AMD Acceleration) AMD Radeon/Instinct GPU with ROCm v6.0+ drivers installed.

### Quick Start

#### Option A: One-Click Windows Launcher
Double-click `run.bat` or execute in terminal:
```cmd
run.bat
```

#### Option B: Manual Setup

##### 1. Install Backend Dependencies & Run FastAPI Server
```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Start Python backend server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

##### 2. Install Frontend Dependencies & Run React Dev Server
```bash
# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running Tests

### Run Python Backend Tests
```bash
python -m unittest discover backend/tests
```

### Run Frontend Unit Tests
```bash
npx vitest run
```

---

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design & component breakdown
- [AMD.md](AMD.md) — AMD ROCm setup, hardware detection, & benchmarking
- [SECURITY.md](SECURITY.md) — Security guardrails, prompt injection defense, & privacy
- [API.md](API.md) — FastAPI REST & WebSocket endpoint specification
- [DEMO.md](DEMO.md) — Hackathon demonstration flows
- [BENCHMARKS.md](BENCHMARKS.md) — Latency and performance methodology
- [PITCH.md](PITCH.md) — Presentation pitch script
