import type { ModelProvider, Planner, PlannerPlan } from "../types/providers";
import { findTool, listTools } from "../lib/tools/registry";

export const HELP_TEXT =
  "I can check the time, evaluate math, report on the project, or inspect your local inference environment. " +
  "Try: \"What time is it?\", \"2.5 * 4 + 1\", \"Find the unfinished tasks\", or \"Check my local AI environment\".";

const UNMATCHED = `I couldn't map that to a tool I can run right now (${
  listTools()
    .map((t) => `\`${t.name}\``)
    .join(", ")
}). ${HELP_TEXT}`;

interface Rule {
  name: string;
  tool: string | null;
  match(norm: string, raw: string): Record<string, unknown> | null;
}

/** Returns a single normalized, punctuation-collapsed lowercase string. */
export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s+\-*/().%?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExpression(raw: string): string | null {
  const cleaned = raw.replace(/[?]/g, " ").replace(/[×·]/g, "*").replace(/−/g, "-").replace(/÷/g, "/");
  const match = cleaned.match(/[-+\d][\d\s+\-*/().%]*[+\-*/%][\d\s+\-*/().%]*/);
  if (!match) return null;
  const expr = match[0].trim();
  if (!/\d/.test(expr)) return null;
  return expr;
}

const RULES: Rule[] = [
  {
    name: "get_current_time",
    tool: "get_current_time",
    match(norm) {
      return /\b(time|time is it|clock|today|what's the date|date is it)\b/.test(norm) ? {} : null;
    },
  },
  {
    name: "calculator",
    tool: "calculator",
    match(_norm, raw) {
      const expression = extractExpression(raw);
      return expression ? { expression } : null;
    },
  },
  {
    name: "memory_save",
    tool: "memory_save",
    match(_norm, raw) {
      // "do you remember…" is a recall, not a save.
      if (/\b(do|does|did|what|how|can|could|would)\s+(you|i|we)\s+remember\b/i.test(raw)) return null;
      const m = raw.match(
        /(?:remember|memorize|note that|keep in mind|say that|never forget)\s+(.+)/i,
      );
      if (!m) return null;
      const text = m[1].replace(/[?.!]+$/, "").trim();
      if (!text) return null;
      let type: "conversation-summary" | "project-context" | "preference" = "conversation-summary";
      if (/(prefer|preference|always|never|like to|want|usually)\b/i.test(text)) type = "preference";
      else if (/(project|build|app|repo|roadmap|demo|docs|document)\b/i.test(text))
        type = "project-context";
      return { text, type };
    },
  },
  {
    name: "memory_recall",
    tool: "memory_recall",
    match(norm) {
      const direct = /\b(recall|remembered|my memories)\b/.test(norm);
      const asked =
        /\b(what|do you|do i|did you|did i|can you|tell me).{0,16}(remember|recalled|memory|memories)\b/.test(
          norm,
        );
      return direct || asked ? { query: norm } : null;
    },
  },
  {
    name: "memory_delete",
    tool: "memory_delete",
    match(norm, raw) {
      if (!/\b(forget|delete|erase|remove|clear)\b/.test(norm)) return null;
      if (/\b(all|everything|every|entire|memories)\b/.test(norm) || /clear\s+.*memor/.test(norm)) {
        return { all: true };
      }
      const m = raw.match(/\b(?:forget|delete|erase|remove|clear)\s+(.+)/i);
      const rest = m ? m[1].replace(/[?.!]+/g, "").trim() : "";
      if (rest && !/^(the|my|that|this|it|all)\s*memor(y|ies)?$/i.test(rest)) {
        return { query: rest };
      }
      return { all: true };
    },
  },
  {
    name: "task_manager",
    tool: "task_manager",
    match(norm) {
      const wantsTasks =
        /\btasks?\b/.test(norm) &&
        /\b(find|show|list|what|get|summarize|status|unfinished|incomplete|open|pending|done|completed|progress)\b/.test(
          norm,
        );
      if (!wantsTasks) return null;
      if (/\b(unfinished|incomplete|open|pending|not done)\b/.test(norm)) return { status: "open" };
      if (/\bin\s*progress|started\b/.test(norm)) return { status: "in_progress" };
      if (/\b(done|completed|finished|closed)\b/.test(norm)) return { status: "done" };
      return {};
    },
  },
  {
    name: "search_documents",
    tool: "search_documents",
    match(norm, raw) {
      const hint =
        /\b(search|look|find|docs?|documents|document|requirement|requirements|prd|blueprint)\b/.test(
          norm,
        ) || /\b(about|mentions?)\b/.test(norm);
      if (!hint) return null;
      const query = raw.trim();
      return query ? { query } : null;
    },
  },
  {
    name: "create_draft",
    tool: "create_draft",
    match(_norm, raw) {
      if (!/\b(summary|draft|prepare|compose|write|update for)\b/i.test(raw)) return null;
      const topic = raw
        .replace(
          /^(please\s+)?(create|prepare|compose|write|draft)\s+(a|an|the)?\s*(summary|draft|update)?\s*/i,
          "",
        )
        .replace(/[?.!]/g, "")
        .trim();
      return { topic: topic.length > 0 ? topic : "team update" };
    },
  },
  {
    name: "project_status",
    tool: "project_status",
    match(norm) {
      const wantsProject =
        /\b(task|tasks|project|projects|unfinished|incomplete|issues|backlog|status)\b/.test(norm);
      const mentionsEnv = /\b(environment|env|gpu|roc|inference|backend|hardware)\b/.test(norm);
      return wantsProject && !mentionsEnv ? {} : null;
    },
  },
  {
    name: "env_status",
    tool: "env_status",
    match(norm) {
      return /\b(environment|env|gpu|roc|inference|backend|hardware|rocm|available|ready to run)\b/.test(
        norm,
      )
        ? {}
        : null;
    },
  },
  {
    name: "greeting",
    tool: null,
    match(norm) {
      if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(norm)) {
        return { customResponse: "Hello! Good morning! I'm Aura, your AI voice assistant. How can I assist you today?" };
      }
      if (/\b(what can you do|help me|your capabilities|what do you do)\b/.test(norm)) {
        return { customResponse: "I am Aura, an autonomous voice utility and response agent. I can help you search indexed documents, manage project tasks, calculate math, check hardware system status, remember preferences, and answer questions." };
      }
      if (/\b(who are you|your name|what are you)\b/.test(norm)) {
        return { customResponse: "I am Aura, a local-first autonomous voice utility and response agent designed for speed, privacy, and productivity." };
      }
      return null;
    },
  },
];

export const deterministicPlanner: Planner = {
  name: "deterministic-planner@0.1",
  modelProvider: "deterministic",
  plan(input: string): PlannerPlan {
    const norm = normalizeInput(input);
    if (norm.length === 0) {
      return { intent: "empty", confidence: 0, response: "I didn't catch that — try typing a request." };
    }
    for (const rule of RULES) {
      const args = rule.match(norm, input);
      if (args === null) continue;
      if (rule.tool) {
        if (findTool(rule.tool)) {
          return { intent: rule.name, confidence: 1, tool: rule.tool, args };
        }
        return {
          intent: rule.name,
          confidence: 0.5,
          response: `The \`${rule.tool}\` tool is registered in the registry but not wired up yet in this build.`,
        };
      }
      if (args.customResponse && typeof args.customResponse === "string") {
        return { intent: rule.name, confidence: 1, response: args.customResponse };
      }
      return { intent: rule.name, confidence: 1, response: HELP_TEXT };
    }
    return { intent: "unknown", confidence: 0, response: UNMATCHED };
  },
};

/** The deterministic "model": an honest, rule-based responder (no cloud, no weights). */
export const deterministicModel: ModelProvider = {
  name: "deterministic-planner@0.1",
  kind: "deterministic",
  available: () => ({ ok: true }),
  complete(response: string) {
    return response;
  },
};