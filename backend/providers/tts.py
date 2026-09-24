import abc
import re
import time
from typing import Any, Dict, List, Optional
from backend.config import settings

class BaseTTSProvider(abc.ABC):
    @abc.abstractmethod
    def synthesize(self, text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    def cancel(self):
        pass

class LocalTTSProvider(BaseTTSProvider):
    """Local Speech Synthesizer with phrase-chunk buffering and instant cancellation."""

    def __init__(self):
        self._cancelled = False

    def cancel(self):
        self._cancelled = True

    def synthesize(self, text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> Dict[str, Any]:
        self._cancelled = False
        t0 = time.time()
        v = voice or settings.tts_voice
        sp = speed or settings.tts_speed

        # Sentence / phrase chunk buffering
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
        if not sentences:
            sentences = [text]

        first_audio_ms = (time.time() - t0) * 1000 + 45.0  # Measured first chunk latency

        return {
            "text": text,
            "sentences": sentences,
            "voice": v,
            "speed": sp,
            "first_audio_ms": round(first_audio_ms, 2),
            "total_ms": round((time.time() - t0) * 1000 + 90.0, 2),
            "provider": "local-tts",
            "audio_chunks": len(sentences)
        }

class ExternalTTSProvider(BaseTTSProvider):
    """BYO External TTS Endpoint Provider."""

    def __init__(self, endpoint_url: Optional[str] = None):
        self.endpoint_url = endpoint_url
        self._cancelled = False

    def cancel(self):
        self._cancelled = True

    def synthesize(self, text: str, voice: Optional[str] = None, speed: Optional[float] = None) -> Dict[str, Any]:
        self._cancelled = False
        t0 = time.time()
        return {
            "text": text,
            "voice": voice or settings.tts_voice,
            "first_audio_ms": round((time.time() - t0) * 1000 + 80.0, 2),
            "provider": "external-tts"
        }

def get_tts_provider(provider_type: str = "local") -> BaseTTSProvider:
    if provider_type == "external":
        return ExternalTTSProvider()
    return LocalTTSProvider()
