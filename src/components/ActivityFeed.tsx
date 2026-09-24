import {
  Activity,
  BadgeCheck,
  Brain,
  CheckCircle2,
  Cpu,
  Mic,
  MessageSquare,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
  Volume2,
  Wrench,
  XCircle,
} from "lucide-react";
import type { AgentEvent } from "../lib/events";

export interface ActivityItem {
  id: string;
  event: AgentEvent;
}

const ICONS: Record<AgentEvent["type"], typeof Activity> = {
  voice_received: Mic,
  transcription_completed: MessageSquare,
  agent_started: Brain,
  intent_identified: Sparkles,
  tool_selected: Wrench,
  tool_started: Wrench,
  tool_completed: CheckCircle2,
  tool_failed: XCircle,
  permission_requested: ShieldQuestion,
  permission_granted: CheckCircle2,
  permission_denied: XCircle,
  verification_started: BadgeCheck,
  verification_completed: BadgeCheck,
  response_generated: MessageSquare,
  tts_started: Volume2,
  tts_completed: Volume2,
  tts_failed: Volume2,
  system: TriangleAlert,
  env_probed: Cpu,
};

const LABELS: Record<AgentEvent["type"], string> = {
  voice_received: "Voice received",
  agent_started: "Agent turn started",
  intent_identified: "Intent identified",
  tool_selected: "Tool selected",
  tool_started: "Tool executing",
  tool_completed: "Tool completed",
  tool_failed: "Tool failed",
  permission_requested: "Permission requested",
  permission_granted: "Permission granted",
  permission_denied: "Permission denied",
  verification_started: "Verifying result",
  verification_completed: "Result verified",
  response_generated: "Response generated",
  tts_started: "Speaking",
  tts_completed: "Speech finished",
  tts_failed: "Voice failed",
  transcription_completed: "Transcribed",
  system: "System",
  env_probed: "Environment probe",
};

function detailOf(event: AgentEvent): string | null {
  switch (event.type) {
    case "tool_selected":
      return `${event.tool} · ${Object.keys(event.args).length > 0 ? JSON.stringify(event.args).slice(0, 56) : "no args"}`;
    case "tool_started":
    case "tool_completed":
      return event.type === "tool_completed" ? `${event.tool} · ${event.ms} ms` : event.tool;
    case "tool_failed":
      return `${event.tool} — ${event.error}`;
    case "intent_identified":
      return `${event.intent}${event.tool ? ` → ${event.tool}` : ""}`;
    case "verification_completed":
      return event.ok ? event.note : `${event.note} — rejected`;
    case "permission_requested":
      return `${event.tool} (${event.level})`;
    case "permission_granted":
    case "permission_denied":
      return event.id;
    case "tts_completed":
      return `${event.ms} ms`;
    case "tts_failed":
      return event.error;
    case "env_probed":
      return event.backend === "local-amd" ? "AMD backend online" : `none — ${event.reason ?? "offline"}`;
    case "system":
      return event.message;
    case "transcription_completed":
    case "response_generated":
      return event.text?.length > 96 ? `${event.text.slice(0, 96)}…` : event.text;
    case "voice_received":
      return `${event.durationMs} ms`;
    case "agent_started":
      return event.input.length > 64 ? `${event.input.slice(0, 64)}…` : event.input;
    default:
      return null;
  }
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No activity yet. Ask AURA something — “What time is it?”, “2.5 * 4 + 1”, “Find the
        unfinished tasks” — and every real step will appear here.
      </p>
    );
  }
  return (
    <ol className="space-y-2.5">
      {items.map(({ id, event }) => {
        const Icon = ICONS[event.type];
        const detail = detailOf(event);
        const tone =
          event.type === "system" || event.type === "tool_failed" || event.type === "tts_failed"
            ? "text-accent"
            : "text-muted";
        return (
          <li
            key={id}
            className="msg-in flex items-start gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5"
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[0.6875rem] tracking-wide text-foreground/90 mono-tick">
                {LABELS[event.type]}
              </p>
              {detail ? (
                <p className="mt-0.5 break-words text-xs leading-snug text-muted">{detail}</p>
              ) : null}
            </div>
            <time
              className="shrink-0 font-mono text-[0.625rem] text-muted/70 tabular-nums"
              dateTime={new Date(event.at).toISOString()}
            >
              {new Date(event.at).toLocaleTimeString([], { hour12: false })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}