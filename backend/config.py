import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

class Settings(BaseModel):
    app_name: str = "AURA — Autonomous Voice Utility & Response Agent"
    version: str = "1.0.0"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8008"))
    data_dir: Path = DATA_DIR
    ai_mode: str = os.getenv("AI_MODE", "local")  # local, hybrid, cloud
    default_model: str = os.getenv("DEFAULT_MODEL", "local-amd-rocm-q4")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    cors_origins: list[str] = ["*"]

    # AssemblyAI & Voice Engine Configuration
    assemblyai_api_key: str = os.getenv("ASSEMBLYAI_API_KEY", "bb857c0cf0ae4adb8549aa38c975fdaa")
    stt_provider: str = os.getenv("STT_PROVIDER", "assemblyai")  # assemblyai, whisper-local, browser
    stt_model: str = os.getenv("STT_MODEL", "universal-3-5-pro")
    stt_language_mode: str = os.getenv("STT_LANGUAGE_MODE", "auto")  # auto, en, hi, gu
    sample_rate: int = int(os.getenv("SAMPLE_RATE", "16000"))

    # BYO LLM Configuration
    llm_provider: str = os.getenv("LLM_PROVIDER", "auto")  # auto, openai, local, deterministic
    llm_base_url: str = os.getenv("LLM_BASE_URL", "")
    llm_api_key: str = (
        os.getenv("LLM_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or os.getenv("GROQ_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("OPENROUTER_API_KEY")
        or ""
    )
    llm_model: str = os.getenv("LLM_MODEL", "")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "512"))

    # BYO TTS Configuration
    tts_provider: str = os.getenv("TTS_PROVIDER", "local")  # local, system, openai
    tts_voice: str = os.getenv("TTS_VOICE", "anna")
    tts_speed: float = float(os.getenv("TTS_SPEED", "1.0"))

settings = Settings()
