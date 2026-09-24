import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".json"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit

PROMPT_INJECTION_PATTERNS = [
    r"ignore all previous instructions",
    r"ignore prior commands",
    r"disregard all previous system messages",
    r"delete all files",
    r"bypass safety",
    r"reveal secret key",
    r"system prompt leak"
]

SECRET_PATTERNS = [
    r"(?i)api[_-]?key\s*[:=]\s*['\"]?([a-zA-Z0-9_\-]{16,})['\"]?",
    r"(?i)bearer\s+([a-zA-Z0-9_\-\.]{20,})",
    r"(?i)password\s*[:=]\s*['\"]?([^\s'\"]{6,})['\"]?",
    r"sk-[a-zA-Z0-9]{32,}"
]

class SecurityGuard:
    """Production Security Engine for input/output sanitization, permissions, and file uploads."""

    @staticmethod
    def sanitize_path(base_dir: Path, target_path: str) -> Path:
        """Prevents path traversal attacks."""
        resolved = (base_dir / target_path).resolve()
        if not str(resolved).startswith(str(base_dir.resolve())):
            raise ValueError(f"Path traversal detected: {target_path}")
        return resolved

    @staticmethod
    def validate_file_upload(filename: str, content_bytes: bytes) -> Tuple[bool, str]:
        """Validates uploaded file size and extension."""
        if len(content_bytes) > MAX_FILE_SIZE_BYTES:
            return False, f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
        
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            return False, f"Unsupported file extension '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        
        return True, "File valid"

    @staticmethod
    def sanitize_prompt_content(content: str, source_type: str = "document") -> str:
        """
        Wraps external document content or tool output with security context boundaries
        to prevent prompt injection attacks.
        """
        cleaned = content
        for pattern in PROMPT_INJECTION_PATTERNS:
            cleaned = re.sub(pattern, "[REDACTED_SUSPICIOUS_INSTRUCTION]", cleaned, flags=re.IGNORECASE)
        
        if source_type in ("document", "web"):
            return f"\n<UNTRUSTED_{source_type.upper()}_CONTENT>\n{cleaned}\n</UNTRUSTED_{source_type.upper()}_CONTENT>\n"
        return cleaned

    @staticmethod
    def redact_secrets(text: str) -> str:
        """Redacts sensitive tokens, keys, and passwords from logs and responses."""
        redacted = text
        for pattern in SECRET_PATTERNS:
            redacted = re.sub(pattern, "[REDACTED_SECRET]", redacted)
        return redacted

    @staticmethod
    def check_permission(tool_level: str, auto_approve_write: bool = False) -> str:
        """
        Determines execution policy for READ, WRITE, DESTRUCTIVE levels.
        Returns: 'allow', 'confirm', or 'deny'
        """
        level = tool_level.upper()
        if level == "READ":
            return "allow"
        elif level == "WRITE":
            return "allow" if auto_approve_write else "confirm"
        elif level == "DESTRUCTIVE":
            return "confirm"
        return "confirm"

guard = SecurityGuard()
