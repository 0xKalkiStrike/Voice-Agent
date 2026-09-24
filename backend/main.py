import json
import time
import uuid
from typing import Any, Dict, Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.config import settings
from backend.db.json_db import db
from backend.amd.diagnostics import get_amd_diagnostics
from backend.agent.brain import brain
from backend.rag.pipeline import rag_pipeline
from backend.memory.store import memory_store
from backend.tools.registry import tool_registry
from backend.metrics.monitor import monitor
from backend.security.guard import guard
from backend.providers.stt import get_stt_provider, AssemblyAIRealtimeSTTProvider
from backend.providers.tts import get_tts_provider

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Production-Ready Autonomous Voice Utility & Response Agent API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    auto_approve_write: Optional[bool] = False

class ToolExecuteRequest(BaseModel):
    tool_name: str
    args: Dict[str, Any]
    auto_approve_write: Optional[bool] = False

class MemoryCreateRequest(BaseModel):
    text: str
    memory_type: Optional[str] = "user_preference"

@app.get("/health")
def health_check():
    amd = get_amd_diagnostics()
    return {
        "status": "READY",
        "app_name": settings.app_name,
        "version": settings.version,
        "ai_mode": settings.ai_mode,
        "stt_provider": settings.stt_provider,
        "stt_model": settings.stt_model,
        "backend": amd["backend"],
        "rocm_available": amd["available"],
        "rocm": amd.get("rocm_version"),
        "gpus": amd.get("gpus", []),
        "driver": amd.get("inference_backend", "ROCm / CPU"),
        "model": settings.default_model,
        "reason": amd.get("reason"),
        "json_db": "CONNECTED"
    }

@app.get("/api/system")
def get_system_info():
    amd = get_amd_diagnostics()
    return {
        "app_name": settings.app_name,
        "version": settings.version,
        "ai_mode": settings.ai_mode,
        "default_model": settings.default_model,
        "stt_provider": settings.stt_provider,
        "stt_model": settings.stt_model,
        "language_mode": settings.stt_language_mode,
        "data_dir": str(settings.data_dir),
        "amd_diagnostics": amd
    }

@app.get("/api/models")
def get_models():
    return {
        "active_model": settings.default_model,
        "models": [
            {"id": "local-amd-rocm-q4", "name": "AURA Local ROCm quantized", "provider": "local"},
            {"id": "local-cpu-deterministic", "name": "AURA CPU Offline Fallback", "provider": "local"}
        ]
    }

@app.get("/api/amd")
def get_amd_info():
    return get_amd_diagnostics()

@app.post("/api/chat")
def chat_endpoint(req: ChatRequest):
    return brain.process_turn(req.message, auto_approve_write=req.auto_approve_write or False)

@app.post("/api/transcribe")
def transcribe_endpoint():
    stt = get_stt_provider(settings.stt_provider)
    return stt.transcribe(b"")

@app.post("/api/synthesize")
def synthesize_endpoint(data: Dict[str, str]):
    text = data.get("text", "")
    tts = get_tts_provider(settings.tts_provider)
    return tts.synthesize(text)

@app.get("/api/documents")
def list_documents():
    return db.read_collection("documents", default=[])

@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    content_bytes = await file.read()
    ok, msg = guard.validate_file_upload(file.filename or "file.txt", content_bytes)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    
    text = content_bytes.decode("utf-8", errors="replace")
    doc = rag_pipeline.process_and_index_document(file.filename or "file.txt", text, mime_type=file.content_type or "text/plain")
    return {"status": "indexed", "document": doc}

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    removed = db.delete("documents", lambda d: d.get("id") == doc_id or d.get("filename") == doc_id)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"status": "deleted", "id": doc_id}

@app.get("/api/memory")
def get_memories(q: Optional[str] = None):
    return memory_store.get_memories(query=q)

@app.post("/api/memory")
def create_memory(req: MemoryCreateRequest):
    return memory_store.save_memory(req.text, memory_type=req.memory_type or "user_preference")

@app.delete("/api/memory/{mem_id}")
def delete_memory(mem_id: str):
    removed = memory_store.delete_memory(mem_id)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"status": "deleted", "id": mem_id}

@app.get("/api/tools")
def list_tools():
    return tool_registry.list_tools()

@app.post("/api/tools/execute")
def execute_tool(req: ToolExecuteRequest):
    return brain.execute_tool_step(req.tool_name, req.args)

@app.get("/api/metrics")
def get_metrics():
    return monitor.get_summary()

@app.post("/api/benchmark")
def run_benchmark():
    t0 = time.time()
    res1 = brain.process_turn("Check my local AI environment")
    t1 = time.time()
    amd = get_amd_diagnostics()
    
    return {
        "timestamp": time.time(),
        "backend": amd["backend"],
        "rocm_available": amd["available"],
        "turn_latency_ms": round((t1 - t0) * 1000, 2),
        "gpu_utilization_pct": amd.get("gpu_utilization_pct", 0),
        "vram_used_mb": amd.get("vram_used_mb", 0),
        "details": res1
    }

@app.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()
    session_id = f"sess-{uuid.uuid4().hex[:8]}"
    active_tts = get_tts_provider(settings.tts_provider)
    aai_stt = AssemblyAIRealtimeSTTProvider()

    # Initial session ready event
    await websocket.send_json({
        "version": "1",
        "event": "session.ready",
        "session_id": session_id,
        "data": {
            "app_name": settings.app_name,
            "stt_provider": "assemblyai",
            "stt_model": "universal-3-5-pro",
            "sample_rate": settings.sample_rate,
            "backend": get_amd_diagnostics()["backend"],
            "assemblyai_ws_url": aai_stt.get_websocket_url(
                sample_rate=settings.sample_rate,
                model="universal-3-5-pro",
                language_code=settings.stt_language_mode
            )
        }
    })

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                payload = json.loads(raw_text)
            except Exception:
                payload = {"type": "chat", "message": raw_text}

            msg_type = payload.get("type", "chat")

            if msg_type == "ping":
                await websocket.send_json({"version": "1", "event": "pong", "session_id": session_id})

            elif msg_type == "tts.interrupt":
                # Voice Interruption / Barge-In event
                active_tts.cancel()
                await websocket.send_json({
                    "version": "1",
                    "event": "voice.interrupted",
                    "session_id": session_id,
                    "data": {"message": "TTS playback interrupted by user speech."}
                })

            elif msg_type == "audio.start":
                await websocket.send_json({
                    "version": "1",
                    "event": "voice.started",
                    "session_id": session_id
                })

            elif msg_type == "audio.chunk":
                # Continuous 16kHz PCM audio chunk received from client
                pass

            elif msg_type == "transcript.partial":
                # Streaming partial transcript event broadcast to client UI
                text = payload.get("text", "")
                await websocket.send_json({
                    "version": "1",
                    "event": "transcript.partial",
                    "session_id": session_id,
                    "data": {
                        "text": text,
                        "end_of_turn": False,
                        "language": payload.get("language", "en")
                    }
                })

            elif msg_type == "transcript.final" or msg_type == "chat":
                user_msg = payload.get("message") or payload.get("text") or ""
                if not user_msg.strip():
                    continue

                # Broadcast final transcript & language event
                await websocket.send_json({
                    "version": "1",
                    "event": "transcript.final",
                    "session_id": session_id,
                    "data": {
                        "text": user_msg,
                        "end_of_turn": True,
                        "language": payload.get("language", "en")
                    }
                })

                # Agent execution pipeline
                await websocket.send_json({
                    "version": "1",
                    "event": "agent.started",
                    "session_id": session_id,
                    "input": user_msg
                })

                result = brain.process_turn(user_msg)

                if result.get("status") == "permission_pending":
                    await websocket.send_json({
                        "version": "1",
                        "event": "permission.requested",
                        "session_id": session_id,
                        "data": result
                    })
                else:
                    tool_used = result.get("tool_used")
                    if tool_used:
                        await websocket.send_json({
                            "version": "1",
                            "event": "agent.tool_completed",
                            "session_id": session_id,
                            "data": {"tool": tool_used, "verified": True}
                        })

                    response_text = result.get("response", "")
                    await websocket.send_json({
                        "version": "1",
                        "event": "response.completed",
                        "session_id": session_id,
                        "data": {"text": response_text}
                    })

                    # TTS audio synthesis
                    tts_res = active_tts.synthesize(response_text)
                    await websocket.send_json({
                        "version": "1",
                        "event": "tts.completed",
                        "session_id": session_id,
                        "data": tts_res
                    })

            elif msg_type == "approve_permission":
                tool_name = payload.get("tool")
                args = payload.get("args", {})
                result = brain.execute_tool_step(tool_name, args)
                response_text = result.get("response", "")
                await websocket.send_json({
                    "version": "1",
                    "event": "response.completed",
                    "session_id": session_id,
                    "data": {"text": response_text}
                })

    except WebSocketDisconnect:
        pass
