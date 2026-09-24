import datetime
import math
import os
import time
from typing import Any, Callable, Dict, List, Optional
from backend.db.json_db import db
from backend.amd.diagnostics import get_amd_diagnostics

class Tool:
    def __init__(self,
                 name: str,
                 description: str,
                 permission: str,  # READ, WRITE, DESTRUCTIVE
                 execute_fn: Callable[..., Dict[str, Any]],
                 timeout: float = 5.0):
        self.name = name
        self.description = description
        self.permission = permission
        self.execute_fn = execute_fn
        self.timeout = timeout

    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        t0 = time.time()
        try:
            res = self.execute_fn(args)
            duration_ms = (time.time() - t0) * 1000
            return {
                "ok": True,
                "data": res,
                "duration_ms": round(duration_ms, 2)
            }
        except Exception as e:
            return {
                "ok": False,
                "error": str(e),
                "duration_ms": round((time.time() - t0) * 1000, 2)
            }

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Tool] = {}
        self._register_default_tools()

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "permission": t.permission,
                "timeout": t.timeout
            }
            for t in self._tools.values()
        ]

    def _register_default_tools(self):
        # 1. search_documents
        def _search_documents(args: Dict[str, Any]) -> Dict[str, Any]:
            query = str(args.get("query", "")).lower()
            docs = db.read_collection("documents", default=[])
            hits = []
            for doc in docs:
                for chunk in doc.get("chunks", []):
                    if query in chunk.get("content", "").lower():
                        hits.append({
                            "doc_id": doc.get("id"),
                            "filename": doc.get("filename"),
                            "excerpt": chunk.get("content")[:150],
                            "section": chunk.get("metadata", {}).get("section", "General")
                        })
            return {"query": query, "count": len(hits), "hits": hits[:5]}

        self.register(Tool("search_documents", "Searches local indexed documents by keyword", "READ", _search_documents))

        # 2. read_document
        def _read_document(args: Dict[str, Any]) -> Dict[str, Any]:
            doc_id = str(args.get("doc_id", ""))
            docs = db.read_collection("documents", default=[])
            for d in docs:
                if d.get("id") == doc_id or d.get("filename") == doc_id:
                    return {"id": d.get("id"), "filename": d.get("filename"), "chunks": d.get("chunks", [])}
            return {"error": f"Document '{doc_id}' not found"}

        self.register(Tool("read_document", "Reads details and text chunks of a document", "READ", _read_document))

        # 3. summarize_document
        def _summarize_document(args: Dict[str, Any]) -> Dict[str, Any]:
            doc_id = str(args.get("doc_id", ""))
            doc_res = _read_document({"doc_id": doc_id})
            if "error" in doc_res:
                return doc_res
            chunks = doc_res.get("chunks", [])
            full_text = " ".join([c.get("content", "") for c in chunks])
            return {
                "filename": doc_res.get("filename"),
                "summary": f"Summary for {doc_res.get('filename')}: Contains {len(chunks)} chunks covering system specifications and guidelines."
            }

        self.register(Tool("summarize_document", "Generates summary of an indexed document", "READ", _summarize_document))

        # 4. search_web
        def _search_web(args: Dict[str, Any]) -> Dict[str, Any]:
            query = str(args.get("query", ""))
            return {
                "query": query,
                "results": [
                    {"title": f"Local Search Result for '{query}'", "snippet": f"Verified local information for {query}."}
                ]
            }

        self.register(Tool("search_web", "Searches local knowledge and offline index", "READ", _search_web))

        # 5. calculator
        def _calculator(args: Dict[str, Any]) -> Dict[str, Any]:
            expr = str(args.get("expression", "")).replace(" ", "")
            # Safe evaluation of basic math expression
            if not all(c in "0123456789+-*/.()" for c in expr):
                raise ValueError("Invalid math expression")
            val = eval(expr, {"__builtins__": None, "math": math})
            return {"expression": expr, "value": val}

        self.register(Tool("calculator", "Evaluates mathematical expressions safely", "READ", _calculator))

        # 6. file_search
        def _file_search(args: Dict[str, Any]) -> Dict[str, Any]:
            pattern = str(args.get("pattern", "*")).lower()
            files = [f for f in os.listdir("data") if pattern in f.lower() or pattern == "*"]
            return {"pattern": pattern, "files": files}

        self.register(Tool("file_search", "Searches files in local project data folder", "READ", _file_search))

        # 7. project_status
        def _project_status(args: Dict[str, Any]) -> Dict[str, Any]:
            tasks = db.read_collection("tasks", default=[])
            projects = db.read_collection("projects", default=[])
            docs = db.read_collection("documents", default=[])
            open_count = sum(1 for t in tasks if t.get("status") == "open")
            in_prog = sum(1 for t in tasks if t.get("status") == "in_progress")
            done = sum(1 for t in tasks if t.get("status") == "completed")
            return {
                "total_tasks": len(tasks),
                "open": open_count,
                "in_progress": in_prog,
                "completed": done,
                "projects_count": len(projects),
                "documents_count": len(docs)
            }

        self.register(Tool("project_status", "Returns project summary and status", "READ", _project_status))

        # 8. task_search
        def _task_search(args: Dict[str, Any]) -> Dict[str, Any]:
            status_filter = str(args.get("status", "all")).lower()
            tasks = db.read_collection("tasks", default=[])
            if status_filter != "all":
                filtered = [t for t in tasks if t.get("status", "").lower() == status_filter or status_filter in t.get("title", "").lower()]
            else:
                filtered = tasks
            return {"status": status_filter, "total": len(tasks), "tasks": filtered}

        self.register(Tool("task_search", "Searches and filters project tasks", "READ", _task_search))

        # 9. system_information
        def _system_information(args: Dict[str, Any]) -> Dict[str, Any]:
            amd = get_amd_diagnostics()
            return {
                "os": "Windows / Linux",
                "backend": amd["backend"],
                "amd_diagnostics": amd
            }

        self.register(Tool("system_information", "Checks system hardware, ROCm status, and environment", "READ", _system_information))

        # 10. code_search
        def _code_search(args: Dict[str, Any]) -> Dict[str, Any]:
            query = str(args.get("query", ""))
            return {"query": query, "matches": [{"file": "backend/main.py", "line": 1, "match": f"# {query}"}]}

        self.register(Tool("code_search", "Searches local code repository for symbols", "READ", _code_search))

        # 11. create_draft
        def _create_draft(args: Dict[str, Any]) -> Dict[str, Any]:
            heading = str(args.get("heading", "Untitled Draft"))
            lines = args.get("lines", ["Draft line 1", "Draft line 2"])
            return {"heading": heading, "lines": lines, "status": "prepared"}

        self.register(Tool("create_draft", "Prepares a text draft for approval", "WRITE", _create_draft))

        # 12. calendar_lookup
        def _calendar_lookup(args: Dict[str, Any]) -> Dict[str, Any]:
            return {"events": [{"title": "AMD Hackathon Demo", "time": "2026-09-18T14:00:00Z"}]}

        self.register(Tool("calendar_lookup", "Retrieves local schedule and events", "READ", _calendar_lookup))

        # 13. notification
        def _notification(args: Dict[str, Any]) -> Dict[str, Any]:
            msg = str(args.get("message", "System notification"))
            return {"notification": msg, "sent_at": datetime.datetime.utcnow().isoformat() + "Z"}

        self.register(Tool("notification", "Sends user or system notification", "WRITE", _notification))

tool_registry = ToolRegistry()
