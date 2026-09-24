import type { AgentTool, ToolContext, ToolResult } from "../../types/providers";
import type { MemoryType } from "../memoryStore";
import { memoryStore } from "../memoryStore";
import { searchDocuments } from "../rag";
import { calculate } from "./calculator";
import demoData from "../../data/demo-data.json";

function parseMemoryType(raw: unknown): MemoryType {
  const v = String(raw ?? "");
  return v === "project-context" || v === "preference" ? v : "conversation-summary";
}

/**
 * The tool registry. Every tool exposes name, description, input schema,
 * permission level and an execution function, so the planner can select
 * dynamically and the orchestrator can gate by permission.
 */
export const TOOLS: AgentTool[] = [
  {
    name: "get_current_time",
    description: "Returns the current date and time in the user's local timezone.",
    permission: "read",
    inputSchema: {},
    execute(_args, ctx: ToolContext): ToolResult {
      const d = ctx.now();
      return {
        ok: true,
        data: {
          iso: d.toISOString(),
          local: d.toLocaleString(),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
    },
  },
  {
    name: "calculator",
    description:
      "Safely evaluates a pure arithmetic expression (+, -, *, /, %, parentheses). Example: '12 * 3 + 4'",
    permission: "read",
    inputSchema: {
      expression: { type: "string", required: true, description: "arithmetic expression" },
    },
    execute(args): ToolResult {
      const expression = String(args.expression ?? "").trim();
      try {
        const value = calculate(expression);
        return { ok: true, data: { expression, value } };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "expression could not be evaluated",
        };
      }
    },
  },
  {
    name: "create_draft",
    description:
      "Composes a summary/update draft from the topic. WRITE level: always requires explicit confirmation before it produces output.",
    permission: "write",
    inputSchema: {
      topic: { type: "string", required: true, description: "what the draft should cover" },
    },
    execute(args, ctx: ToolContext): ToolResult {
      const topic = String(args.topic ?? "").trim() || "team update";
      const at = ctx.now().toLocaleString();
      return {
        ok: true,
        data: {
          heading: `Draft — ${topic}`,
          lines: [
            `Topic: ${topic}`,
            "Status: draft only — nothing has been persisted or sent.",
            `Prepared by the deterministic engine at ${at}.`,
          ],
        },
      };
    },
  },
  {
    name: "env_status",
    description:
      "Reports the detected inference environment: whether the local AMD backend is reachable, ROCm/GPU info, and which provider AURA is using.",
    permission: "read",
    inputSchema: {},
    execute(_args, ctx: ToolContext): ToolResult {
      const s = ctx.envStatus;
      return {
        ok: true,
        data: {
          backend: s.backend,
          amd: s.amd ?? null,
          reason: s.reason ?? null,
          measuredAt: s.measuredAt,
        },
      };
    },
  },
  {
    name: "project_status",
    description:
      "Summarizes the bundled demo project: task counts by state and number of indexed documents.",
    permission: "read",
    inputSchema: {},
    execute(): ToolResult {
      const tasks = demoData.tasks;
      const open = tasks.filter((t) => t.status === "open").length;
      const inProgress = tasks.filter((t) => t.status === "in_progress").length;
      const done = tasks.filter((t) => t.status === "done").length;
      return {
        ok: true,
        data: {
          open,
          inProgress,
          done,
          total: tasks.length,
          documents: demoData.documents.length,
        },
      };
    },
  },
  {
    name: "task_manager",
    description:
      "Lists the bundled project tasks, optionally filtered by status (open, in_progress, done). Reads real bundled data — read-only until the store API is wired.",
    permission: "read",
    inputSchema: {
      status: { type: "string", required: false, description: "open | in_progress | done" },
    },
    execute(args): ToolResult {
      const wanted = String(args.status ?? "").trim().toLowerCase();
      const tasks =
        !wanted || wanted === "all"
          ? demoData.tasks
          : demoData.tasks.filter((t) => t.status === wanted);
      return { ok: true, data: { status: wanted || "all", total: demoData.tasks.length, tasks } };
    },
  },
  {
    name: "search_documents",
    description:
      "Keyword search over the bundled demo documents (PRD excerpt, AMD ROCm blueprint). Returns the top matches with source title, snippet and matched terms — real offline retrieval.",
    permission: "read",
    inputSchema: {
      query: { type: "string", required: true, description: "what to look for" },
    },
    execute(args): ToolResult {
      const query = String(args.query ?? "").trim();
      return { ok: true, data: { query, count: query ? searchDocuments(query).length : 0, hits: query ? searchDocuments(query) : [] } };
    },
  },
  {
    name: "memory_save",
    description:
      "Stores an explicitly requested memory (preference, project-context or conversation-summary). WRITE level: asks for confirmation unless auto-approve is on.",
    permission: "write",
    inputSchema: {
      text: { type: "string", required: true, description: "what to remember" },
      type: { type: "string", required: false, description: "preference | project-context | conversation-summary" },
    },
    execute(args): ToolResult {
      const text = String(args.text ?? "").trim();
      if (!text) return { ok: false, error: "nothing to remember" };
      const entry = memoryStore.save(text, parseMemoryType(args.type));
      return { ok: true, data: { id: entry.id, text: entry.text, type: entry.type, total: memoryStore.list().length } };
    },
  },
  {
    name: "memory_recall",
    description:
      "Retrieves stored memories matching a query by keyword. READ level — returns what it finds, or honestly reports nothing.",
    permission: "read",
    inputSchema: {
      query: { type: "string", required: true, description: "what to search memory for" },
    },
    execute(args): ToolResult {
      const query = String(args.query ?? "").trim();
      const entries = memoryStore.recall(query, 3);
      return { ok: true, data: { query, count: entries.length, entries } };
    },
  },
  {
    name: "memory_delete",
    description:
      "Deletes stored memories (by free-text match, or all of them). DESTRUCTIVE — always requires explicit confirmation, never auto-runs.",
    permission: "destructive",
    inputSchema: {
      query: { type: "string", required: false, description: "what to forget" },
      all: { type: "boolean", required: false, description: "forget everything" },
    },
    execute(args): ToolResult {
      if (args.all === true) {
        const removed = memoryStore.clear();
        return { ok: true, data: { removed, all: true } };
      }
      const query = String(args.query ?? "").trim();
      if (!query) return { ok: true, data: { removed: 0, all: false, query } };
      const removed = memoryStore.removeWhere((e) => e.text.toLowerCase().includes(query.toLowerCase()));
      return { ok: true, data: { removed, all: false, query } };
    },
  },
];

export function findTool(name: string): AgentTool | undefined {
  return TOOLS.find((t) => t.name === name);
}

export function listTools(): AgentTool[] {
  return [...TOOLS];
}