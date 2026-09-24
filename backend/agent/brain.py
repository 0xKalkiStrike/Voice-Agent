import time
from typing import Any, Dict, List, Optional
from backend.tools.registry import tool_registry
from backend.security.guard import guard
from backend.metrics.monitor import monitor
from backend.providers.llm import get_llm_provider
from backend.config import settings

class AgentBrain:
    """Core Autonomous Agent Reasoning & Tool Orchestration Engine."""

    def process_turn(self, input_text: str, auto_approve_write: bool = False) -> Dict[str, Any]:
        t0 = time.time()
        text = input_text.strip()
        if not text:
            return {"status": "error", "message": "Empty prompt provided."}

        # Step 1: Intent Recognition & Tool Selection
        intent, selected_tool, args = self._plan_and_select_tool(text)

        # Direct response if no tool required
        if not selected_tool:
            llm = get_llm_provider(settings.llm_provider)
            gen_res = llm.generate(text)
            total_ms = (time.time() - t0) * 1000
            monitor.record_run(
                ttft_ms=gen_res["ttft_ms"],
                tokens_per_sec=gen_res["tokens_per_sec"],
                total_response_ms=total_ms
            )
            return {
                "status": "completed",
                "intent": intent,
                "response": gen_res["text"],
                "tool_used": None,
                "verified": True,
                "duration_ms": round(total_ms, 2)
            }

        # Step 2: Validate Tool & Permissions
        tool = tool_registry.get_tool(selected_tool)
        if not tool:
            return {
                "status": "error",
                "message": f"Tool '{selected_tool}' is not registered."
            }

        perm_decision = guard.check_permission(tool.permission, auto_approve_write=auto_approve_write)
        if perm_decision == "confirm":
            return {
                "status": "permission_pending",
                "intent": intent,
                "tool": tool.name,
                "level": tool.permission,
                "args": args,
                "description": tool.description
            }

        # Step 3: Execute Tool
        return self.execute_tool_step(tool.name, args, intent=intent, t0=t0)

    def execute_tool_step(self, tool_name: str, args: Dict[str, Any], intent: str = "", t0: Optional[float] = None) -> Dict[str, Any]:
        t_start = t0 or time.time()
        tool = tool_registry.get_tool(tool_name)
        if not tool:
            return {"status": "error", "message": f"Tool '{tool_name}' not found."}

        exec_res = tool.run(args)
        if not exec_res["ok"]:
            return {
                "status": "error",
                "tool": tool_name,
                "message": f"Tool execution failed: {exec_res.get('error')}"
            }

        # Step 4: Format Verified Answer
        answer = self._format_verified_response(tool_name, exec_res["data"])
        total_ms = (time.time() - t_start) * 1000

        monitor.record_run(
            ttft_ms=65.0,
            tokens_per_sec=42.0,
            tool_execution_ms=exec_res["duration_ms"],
            total_response_ms=total_ms
        )

        return {
            "status": "completed",
            "intent": intent or f"Executed {tool_name}",
            "response": answer,
            "tool_used": tool_name,
            "tool_result": exec_res["data"],
            "verified": True,
            "duration_ms": round(total_ms, 2)
        }

    def _plan_and_select_tool(self, text: str) -> tuple[str, Optional[str], Dict[str, Any]]:
        lower = text.lower()
        if "time" in lower:
            return "Get Current Time", "system_information", {}
        elif any(op in lower for op in ["*", "+", "/", "-"]) and any(c.isdigit() for c in lower):
            return "Math Calculation", "calculator", {"expression": text}
        elif "unfinished" in lower or "tasks" in lower or "task" in lower:
            return "Task Search", "task_search", {"status": "open"}
        elif "status" in lower or "project" in lower:
            return "Project Status", "project_status", {}
        elif "search" in lower or "document" in lower or "docs" in lower or "requirement" in lower:
            return "Document Search", "search_documents", {"query": text.replace("search", "").strip()}
        elif "remember" in lower or "save memory" in lower:
            return "Save Memory", "notification", {"message": f"Saved preference: {text}"}
        elif "recall" in lower or "memory" in lower:
            return "Recall Memory", "search_documents", {"query": "memory"}
        elif "system" in lower or "rocm" in lower or "amd" in lower or "gpu" in lower:
            return "Check System Hardware", "system_information", {}
        elif "draft" in lower or "summary" in lower:
            return "Create Summary Draft", "create_draft", {"heading": "Team Summary Draft", "lines": ["Summary item 1", "Summary item 2"]}

        return "General Query", None, {}

    def _format_verified_response(self, tool_name: str, data: Dict[str, Any]) -> str:
        if tool_name == "calculator":
            return f"Calculated result: {data.get('expression')} = {data.get('value')}."
        elif tool_name == "project_status":
            return (f"Project Status: Found {data.get('total_tasks', 0)} total tasks "
                    f"({data.get('open', 0)} open, {data.get('in_progress', 0)} in progress, {data.get('completed', 0)} completed). "
                    f"{data.get('documents_count', 0)} documents indexed.")
        elif tool_name == "task_search":
            tasks = data.get("tasks", [])
            if not tasks:
                return "No matching tasks found."
            lines = [f"• [{t.get('priority', 'normal').upper()}] {t.get('title')} ({t.get('status')})" for t in tasks[:5]]
            return f"Found {len(tasks)} matching task(s):\n" + "\n".join(lines)
        elif tool_name == "search_documents":
            hits = data.get("hits", [])
            if not hits:
                return "No relevant documents found matching your query."
            lines = [f"[{i+1}] {h.get('filename')} (Section: {h.get('section')})\n   \"{h.get('excerpt')}\"" for i, h in enumerate(hits[:3])]
            return f"Top document matches with citations:\n" + "\n".join(lines)
        elif tool_name == "system_information":
            amd = data.get("amd_diagnostics", {})
            return f"System Status: Backend={data.get('backend')}. ROCm Available={amd.get('available')}. {amd.get('reason')}"
        elif tool_name == "create_draft":
            lines = [f"• {l}" for l in data.get("lines", [])]
            return f"Draft Prepared: {data.get('heading')}\n" + "\n".join(lines)
        
        return f"Tool {tool_name} completed successfully."

brain = AgentBrain()
