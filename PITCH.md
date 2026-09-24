# AURA Presentation & Pitch Materials

## 30-Second Elevator Pitch
"AURA is a local-first autonomous voice utility agent designed for privacy-conscious professionals and developers. Unlike standard chatbots that process text in the cloud, AURA operates locally on your machine, leveraging AMD ROCm hardware acceleration. AURA listens to your voice, reasons about your objective, selects and executes safe tools, searches your local documents using RAG, verifies every result, and speaks back — all while keeping 100% of your voice recordings and sensitive files private."

---

## 2-Minute Demonstration Script

1. **Introduction & Local Vision (0:00 - 0:30)**:
   - Highlight the core problem with cloud AI assistants: privacy leaks, latency, and fake demo widgets.
   - Introduce AURA: Autonomous Voice Utility & Response Agent running on local AMD hardware.

2. **Voice & Agent Tools in Action (0:30 - 1:15)**:
   - Issue voice query: *"Find the unfinished tasks and prepare a summary for the team."*
   - Show real-time activity feed: Intent recognition -> Task Search tool -> Create Draft tool.
   - Highlight the Permission Bar asking for confirmation before executing the WRITE level tool.

3. **AMD Acceleration & Performance Metrics (1:15 - 2:00)**:
   - Open AMD Diagnostics tab showing real GPU utilization, VRAM, ROCm driver info, and TTFT/throughput metrics.
   - Conclude with offline RAG document query showing source citations.

---

## 5-Minute Technical Deep Dive

- **Architecture**: Separated FastAPI backend + React/TypeScript UI connected via WebSocket event pipeline (`/ws/voice`).
- **AMD ROCm Integration**: Direct inspection of `rocm-smi` and PyTorch HIP. Honest detection with fallback to CPU deterministic mode without fabricated metrics.
- **Security & Privacy**: Document content isolation with prompt injection defenses and permission gates (READ, WRITE, DESTRUCTIVE).
- **JSON File Persistence**: Local file database (`data/*.json`) replacing external cloud DBs for zero-friction setup.
