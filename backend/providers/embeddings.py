import hashlib
from typing import List

class LocalEmbeddingProvider:
    """Lightweight deterministic vector embedding generator for local RAG."""
    def embed_text(self, text: str) -> List[float]:
        tokens = text.lower().split()
        vector = [0.0] * 16
        for i, token in enumerate(tokens):
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            vector[i % 16] += (h % 100) / 100.0
        # Normalize
        norm = sum(x*x for x in vector) ** 0.5 or 1.0
        return [round(x / norm, 4) for x in vector]

def get_embedding_provider() -> LocalEmbeddingProvider:
    return LocalEmbeddingProvider()
