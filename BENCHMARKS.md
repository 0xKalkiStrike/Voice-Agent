# AURA Benchmark Engine & Performance Metrics

AURA records empirical runtime latency metrics for every turn and provides a benchmark endpoint (`POST /api/benchmark`).

## Tracked Metrics

- **TTFT (Time To First Token)**: Latency in milliseconds from input reception to initial token generation.
- **Throughput**: Measured in tokens per second.
- **STT Latency**: Speech-to-Text transcription time.
- **TTS Latency**: Text-to-Speech audio synthesis duration.
- **Tool Execution Latency**: Time spent running tool functions.
- **RAG Retrieval Latency**: Time spent embedding queries and scoring document chunks.
- **Total Response Latency**: End-to-end roundtrip latency.

## Running Benchmark

You can trigger a real-time benchmark via REST endpoint:
```bash
curl -X POST http://localhost:8000/api/benchmark
```
Results are saved to `data/metrics.json` and presented in the UI Performance panel.
