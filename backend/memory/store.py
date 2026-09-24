import datetime
from typing import Any, Dict, List, Optional
from backend.db.json_db import db

class MemoryStore:
    """Manages short-term conversation context and long-term user memories."""

    def save_memory(self, text: str, memory_type: str = "user_preference") -> Dict[str, Any]:
        item = {
            "id": f"mem-{int(datetime.datetime.utcnow().timestamp()*1000)}",
            "text": text,
            "type": memory_type,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
        db.insert("memories", item)
        return item

    def get_memories(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        memories = db.read_collection("memories", default=[])
        if not query:
            return memories
        q = query.lower()
        return [m for m in memories if q in m.get("text", "").lower() or q in m.get("type", "").lower()]

    def delete_memory(self, memory_id: str) -> int:
        return db.delete("memories", lambda item: item.get("id") == memory_id)

    def clear_all(self) -> bool:
        return db.write_collection("memories", [])

memory_store = MemoryStore()
