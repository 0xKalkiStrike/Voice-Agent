import datetime
from typing import Any, Dict, List, Optional
from backend.db.json_db import db
from backend.providers.embeddings import get_embedding_provider
from backend.security.guard import guard

class RAGPipeline:
    """Document Intelligence and Vector Retrieval Engine."""

    def __init__(self):
        self.embedding_provider = get_embedding_provider()

    def process_and_index_document(self, filename: str, content_text: str, mime_type: str = "text/plain") -> Dict[str, Any]:
        # Validate upload content
        ok, msg = guard.validate_file_upload(filename, content_text.encode("utf-8"))
        if not ok:
            raise ValueError(msg)

        # Sanitize prompt injection
        safe_text = guard.sanitize_prompt_content(content_text, source_type="document")

        # Chunk text
        chunks = self._chunk_text(safe_text, chunk_size=300)
        chunk_objects = []
        for i, chunk_text in enumerate(chunks):
            embedding = self.embedding_provider.embed_text(chunk_text)
            chunk_objects.append({
                "id": f"chunk-{int(datetime.datetime.utcnow().timestamp())}-{i}",
                "index": i,
                "content": chunk_text,
                "embedding": embedding,
                "metadata": {"section": f"Chunk {i+1}"}
            })

        doc_record = {
            "id": f"doc-{int(datetime.datetime.utcnow().timestamp())}",
            "filename": filename,
            "mime_type": mime_type,
            "size_bytes": len(content_text.encode("utf-8")),
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
            "chunks": chunk_objects
        }

        db.insert("documents", doc_record)
        return doc_record

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        query_vector = self.embedding_provider.embed_text(query)
        docs = db.read_collection("documents", default=[])
        results = []

        for doc in docs:
            for chunk in doc.get("chunks", []):
                content = chunk.get("content", "")
                emb = chunk.get("embedding")
                score = 0.0
                if emb:
                    # Cosine similarity
                    dot = sum(a*b for a, b in zip(query_vector, emb))
                    score = dot
                else:
                    # Keyword fallback
                    if query.lower() in content.lower():
                        score = 0.8

                if score > 0.1 or query.lower() in content.lower():
                    results.append({
                        "score": round(score, 4),
                        "filename": doc.get("filename"),
                        "doc_id": doc.get("id"),
                        "excerpt": content[:200],
                        "chunk_index": chunk.get("index")
                    })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def _chunk_text(self, text: str, chunk_size: int = 300) -> List[str]:
        words = text.split()
        if not words:
            return ["Empty document."]
        chunks = []
        for i in range(0, len(words), chunk_size):
            chunks.append(" ".join(words[i:i+chunk_size]))
        return chunks

rag_pipeline = RAGPipeline()
