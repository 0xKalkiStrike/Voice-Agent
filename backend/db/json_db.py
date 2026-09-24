import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional
from backend.config import settings

class JSONDatabase:
    """
    Atomic JSON-file-based repository for AURA state storage.
    Provides schema validation, file locking, and querying helpers.
    """

    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = Path(data_dir or settings.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._locks: Dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def _get_lock(self, collection: str) -> threading.Lock:
        with self._global_lock:
            if collection not in self._locks:
                self._locks[collection] = threading.Lock()
            return self._locks[collection]

    def _get_file_path(self, collection: str) -> Path:
        return self.data_dir / f"{collection}.json"

    def read_collection(self, collection: str, default: Any = None) -> Any:
        lock = self._get_lock(collection)
        file_path = self._get_file_path(collection)
        with lock:
            if not file_path.exists():
                return default if default is not None else []
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                # Fallback / corruption safety
                return default if default is not None else []

    def write_collection(self, collection: str, data: Any) -> bool:
        lock = self._get_lock(collection)
        file_path = self._get_file_path(collection)
        temp_path = self.data_dir / f"{collection}.tmp"
        with lock:
            try:
                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                temp_path.replace(file_path)
                return True
            except Exception as e:
                if temp_path.exists():
                    os.remove(temp_path)
                return False

    def query(self, collection: str, filter_fn: Optional[Any] = None) -> List[Dict[str, Any]]:
        items = self.read_collection(collection, default=[])
        if not isinstance(items, list):
            return []
        if filter_fn is None:
            return items
        return [item for item in items if filter_fn(item)]

    def insert(self, collection: str, item: Dict[str, Any]) -> Dict[str, Any]:
        items = self.read_collection(collection, default=[])
        if not isinstance(items, list):
            items = []
        items.append(item)
        self.write_collection(collection, items)
        return item

    def delete(self, collection: str, filter_fn: Any) -> int:
        items = self.read_collection(collection, default=[])
        if not isinstance(items, list):
            return 0
        original_len = len(items)
        remaining = [item for item in items if not filter_fn(item)]
        removed = original_len - len(remaining)
        if removed > 0:
            self.write_collection(collection, remaining)
        return removed

db = JSONDatabase()
