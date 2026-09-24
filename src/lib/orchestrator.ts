import type {
  AgentStatus,
  AgentTool,
  EnvProbe,
  PermissionLevel,
  ToolContext,
  ToolResult,
} from "../types/providers";
import { decisionFor, levelLabel } from "./permissions";
import type { EventBus } from "./events";
import { verifyToolResult } from "./verifier";
import { findTool, listTools } from "./tools/registry";
import { deterministicPlanner } from "../providers/deterministic";

export interface PermissionRequest {
  id: string;
  tool: string;
  level: PermissionLevel;
  label: string;
  args: Record<string, unknown>;
  input: string;
  description: string;
}

/** Everything the orchestrator needs from the UI shell. Keep it small. */
export interface OrchestratorDeps {
  bus: EventBus;
  probeEnv: () => Promise<EnvProbe>;
  policy: { autoApproveWrite: boolean };
  onStatus: (s: AgentStatus) => void;
  onPermission: (p: PermissionRequest | null) => void;
}
interface PendingRun {
  req: PermissionRequest;
  context: ToolContext;
}

const ENV_TTL_MS = 15000;

let permCounter = 0;

/**
 * The agent loop: plan → (gate) → select tool → execute → verify → respond.
 * All side channels go through the event bus (types/events.ts), so the UI
 * timeline shows real steps and nothing is faked.
 */
export class AgentOrchestrator {
  private readonly deps: OrchestratorDeps;
  private readonly tools: AgentTool[];
  private envProbe: EnvProbe | null = null;
  private envAt = 0;
  private pending: PendingRun | null = null;
  private busy = false;

  constructor(deps: OrchestratorDeps) {
    this.deps = deps;
    this.tools = listTools();
  }

  get toolsList(): AgentTool[] {
    return this.tools;
  }

  async envStatus(): Promise<EnvProbe> {
    const now = Date.now();
    if (this.envProbe && now - this.envAt < ENV_TTL_MS) return this.envProbe;
    const probe = await this.deps.probeEnv();
    this.envProbe = probe;
    this.envAt = Date.now();
    this.deps.bus.emit({
      type: "env_probed",
      at: probe.measuredAt,
      backend: probe.backend,
      reason: probe.reason,
    });
    return probe;
  }

  /** Bypasses the cache and forces a fresh hardware/environment probe. */
  async refreshEnv(): Promise<EnvProbe> {
    this.envProbe = null;
    return this.envStatus();
  }

  async run(inputRaw: string): Promise<void> {
    const input = inputRaw.trim();
    if (!input) return;
    if (this.busy) {
      this.deps.bus.emit({
        type: "system",
        at: Date.now(),
        kind: "warn",
        message: "AURA is busy — the current turn must finish first.",
      });
      return;
    }
    this.busy = true;
    this.deps.bus.emit({ type: "agent_started", at: Date.now(), input });
    this.deps.onStatus("thinking");
    try {
      const env = await this.envStatus();
      const context: ToolContext = { envStatus: env, now: () => new Date() };
      const plan = await deterministicPlanner.plan(input, {
        tools: this.tools,
        now: context.now,
      });
      this.deps.bus.emit({
        type: "intent_identified",
        at: Date.now(),
        intent: plan.intent,
        tool: plan.tool,
      });
      if (plan.response !== undefined) {
        this.respond(plan.response);
        return;
      }
      const tool = plan.tool ? findTool(plan.tool) : undefined;
      if (!tool) {
        this.respond(`The tool \`${plan.tool ?? "?"}\` is not registered in this build.`);
        return;
      }
      const args = plan.args ?? {};
      this.deps.bus.emit({ type: "tool_selected", at: Date.now(), tool: tool.name, args });
      const decision = decisionFor(tool.permission, { autoApproveWrite: this.deps.policy.autoApproveWrite });
      if (decision === "confirm") {
        const req: PermissionRequest = {
          id: `perm-${++permCounter}`,
          tool: tool.name,
          level: tool.permission,
          label: levelLabel(tool.permission),
          args,
          input,
          description: tool.description,
        };
        this.pending = { req, context };
        this.deps.onPermission(req);
        this.deps.bus.emit({
          type: "permission_requested",
          at: Date.now(),
          tool: tool.name,
          level: tool.permission,
          id: req.id,
        });
        this.deps.onStatus("permission-pending");
        return;
      }
      await this.executeTool(tool, args, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown orchestrator error";
      this.deps.bus.emit({ type: "system", at: Date.now(), kind: "error", message });
      this.deps.onStatus("error");
      this.respond(`I hit an unexpected error: ${message}. I stopped there — nothing was changed.`);
    }
  }

  async approve(id: string): Promise<void> {
    if (!this.pending || this.pending.req.id !== id) return;
    const { req, context } = this.pending;
    this.pending = null;
    this.deps.onPermission(null);
    this.deps.bus.emit({ type: "permission_granted", at: Date.now(), id: req.id });
    this.deps.onStatus("thinking");
    const tool = findTool(req.tool);
    if (!tool) {
      this.respond(`The tool \`${req.tool}\` is no longer registered — nothing was executed.`);
      return;
    }
    await this.executeTool(tool, req.args, context);
  }

  deny(id: string): void {
    if (!this.pending || this.pending.req.id !== id) return;
    const { req } = this.pending;
    this.pending = null;
    this.deps.onPermission(null);
    this.deps.bus.emit({ type: "permission_denied", at: Date.now(), id: req.id });
    this.respond(
      `Understood — I cancelled the ${req.label.toLowerCase()} \`${req.tool}\` action. No changes were made.`,
    );
  }

  cancelPending(): void {
    if (this.pending) this.deny(this.pending.req.id);
  }

  private async executeTool(
    tool: AgentTool,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<void> {
    this.deps.bus.emit({ type: "tool_started", at: Date.now(), tool: tool.name });
    this.deps.onStatus("using-tool");
    const t0 = performance.now();
    let result: ToolResult;
    try {
      result = await tool.execute(args, context);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : "unexpected tool error" };
    }
    const ms = Math.round(performance.now() - t0);
    if (!result.ok) {
      const error = result.error ?? "no detail";
      this.deps.bus.emit({ type: "tool_failed", at: Date.now(), tool: tool.name, error });
      this.deps.bus.emit({
        type: "system",
        at: Date.now(),
        kind: "error",
        message: `Tool ${tool.name} failed: ${error}`,
      });
      this.deps.onStatus("error");
      this.respond(`The \`${tool.name}\` tool reported a problem (${error}). I stopped before doing anything else.`);
      return;
    }
    this.deps.bus.emit({ type: "tool_completed", at: Date.now(), tool: tool.name, ok: true, ms });
    this.deps.bus.emit({ type: "verification_started", at: Date.now() });
    this.deps.onStatus("verifying");
    const v = verifyToolResult(tool.name, result);
    this.deps.bus.emit({ type: "verification_completed", at: Date.now(), ok: v.ok, note: v.note });
    if (!v.ok) {
      this.deps.onStatus("error");
      this.respond(`I couldn't verify the result from \`${tool.name}\` (${v.note}) — I won't present it as fact.`);
      return;
    }
    this.respond(formatAnswer(tool.name, result));
  }

  private respond(text: string): void {
    this.deps.bus.emit({ type: "response_generated", at: Date.now(), text });
    this.busy = false;
  }
}

function formatAnswer(toolName: string, result: ToolResult): string {
  const data = result.data as Record<string, unknown> & {
    local?: string;
    tz?: string;
    expression?: string;
    value?: number;
    backend?: string;
    amd?: { rocm?: string; gpus?: string[] };
    reason?: string;
    open?: number;
    inProgress?: number;
    done?: number;
    total?: number;
    documents?: number;
  };
  switch (toolName) {
    case "get_current_time":
      return `The local time is ${data.local ?? "unknown"} (${data.tz ?? "local timezone"}).`;
    case "calculator":
      return `Calculated: ${data.expression} = ${data.value}.`;
    case "env_status": {
      if (data.backend === "local-amd") {
        const gpus = data.amd?.gpus?.length ? data.amd.gpus.join(", ") : "GPU detected";
        return `Local AMD acceleration is active. ${gpus}; ROCm ${data.amd?.rocm ?? "runtime ready"}. Local inference will be AMP-accelerated.`;
      }
      return `No local AMD backend is reachable, so AURA is running its deterministic offline engine (no cloud, no uploads). ${data.reason ?? ""}`.trim();
    }
    case "project_status":
      return `Found ${data.total ?? 0} project items: ${data.open ?? 0} open, ${data.inProgress ?? 0} in progress, ${data.done ?? 0} completed. ${data.documents ?? 0} documents are indexed for retrieval.`;
    case "create_draft": {
      const draft = data as unknown as { heading?: string; lines?: string[] };
      const lines = (draft.lines ?? []).map((l) => `• ${l}`).join("\n");
      return `Draft prepared: ${draft.heading ?? "untitled"}\n${lines}`;
    }
    case "task_manager": {
      const d = data as { status?: string; total?: number; tasks?: Array<{ title: string }> };
      const tasks = d.tasks ?? [];
      const status = d.status && d.status !== "all" ? d.status : "all";
      if (tasks.length === 0) {
        return `No tasks match "${status}" in the bundled project (${d.total ?? 0} total). Nothing here is fabricated — the read-only dataset is what it is.`;
      }
      const lines = tasks.slice(0, 8).map((t) => `• ${t.title}`).join("\n");
      return `Found ${tasks.length} ${status} task${tasks.length === 1 ? "" : "s"} (of ${d.total ?? 0} project items):\n${lines}`;
    }
    case "search_documents": {
      const d = data as {
        query?: string;
        count?: number;
        hits?: Array<{ title: string; excerpt: string; chunkIndex: number }>;
      };
      const hits = d.hits ?? [];
      if (hits.length === 0) {
        return `No hits for "${d.query ?? ""}" in the indexed demo documents — try different keywords, and I'll re-check.`;
      }
      const lines = hits
        .map((h, i) => `[${i + 1}] "${h.excerpt}" — ${h.title} (snippet ${h.chunkIndex + 1})`)
        .join("\n");
      return `Top ${hits.length} match(es) with citations for "${d.query}":\n${lines}`;
    }
    case "memory_save": {
      const d = data as { text?: string; type?: string; total?: number };
      return `Saved to memory: "${(d.text ?? "").slice(0, 90)}" (${d.type ?? "conversation-summary"}) — ${d.total ?? 1} item(s) now. Say "recall" anytime to retrieve it.`;
    }
    case "memory_recall": {
      const d = data as { count?: number; entries?: Array<{ text: string; type: string }> };
      if (!d.count || d.count === 0) {
        return "Nothing in memory matches that — I only store what you explicitly ask me to remember.";
      }
      const lines = (d.entries ?? []).map((e) => `• "${e.text}" (${e.type})`).join("\n");
      return `From my memory (${d.count}):\n${lines}`;
    }
    case "memory_delete": {
      const d = data as { removed?: number; query?: string };
      const n = d.removed ?? 0;
      if (n === 0) return "Nothing was forgotten — no memory matched that.";
      return `Forgotten ${n} memor${n === 1 ? "y" : "ies"}${d.query ? ` matching "${d.query}"` : " (all)"}.`;
    }
    default:
      return `Done. Result: ${JSON.stringify(result.data)}`;
  }
}