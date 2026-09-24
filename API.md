# AURA FastAPI REST & WebSocket API Reference

Base URL: `http://localhost:8000`

## REST Endpoints

### System & Health
- `GET /health` — Returns application status, database status, and ROCm backend status.
- `GET /api/system` — Returns system configuration and directory paths.
- `GET /api/amd` — Returns detailed AMD GPU & ROCm hardware diagnostics.
- `GET /api/models` — Returns available local & offline model runtimes.

### Chat & Voice
- `POST /api/chat` — Processes a user text or voice turn through the Agent Brain.
  - Body: `{"message": "string", "auto_approve_write": false}`
- `POST /api/transcribe` — Speech-to-Text transcription.
- `POST /api/synthesize` — Text-to-Speech audio synthesis.

### RAG Documents
- `GET /api/documents` — Lists indexed documents.
- `POST /api/documents` — Uploads and indexes a new document file.
- `DELETE /api/documents/{id}` — Removes document from RAG vector index & database.

### Memory
- `GET /api/memory` — Retrieves saved user memories.
- `POST /api/memory` — Stores new user memory entry.
- `DELETE /api/memory/{id}` — Deletes memory entry.

### Tools & Metrics
- `GET /api/tools` — Returns list of registered tools and permissions.
- `POST /api/tools/execute` — Executes a specific tool.
- `GET /api/metrics` — Returns performance metrics summary.
- `POST /api/benchmark` — Runs AMD inference benchmark.

## WebSocket Protocol
- `WS /ws/voice` — Real-time event streaming for voice turns, tool activity, and responses.
