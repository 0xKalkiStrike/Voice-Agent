import { useEffect, useRef, type MutableRefObject } from "react";
import { Activity, Mic, ShieldCheck, Sparkles, TriangleAlert, Wifi, Square } from "lucide-react";
import type { AgentStatus } from "../types/providers";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  connecting: "Connecting",
  listening: "Listening",
  transcribing: "Transcribing",
  thinking: "Thinking",
  "using-tool": "Using tool",
  verifying: "Verifying",
  speaking: "Speaking",
  interrupted: "Interrupted",
  "permission-pending": "Awaiting approval",
  error: "Error",
};

interface OrbProps {
  status: AgentStatus;
  levelRef: MutableRefObject<number>;
  recording: boolean;
}

function colorFor(status: AgentStatus): string {
  switch (status) {
    case "error":
    case "using-tool":
      return "var(--color-accent)";
    case "permission-pending":
    case "interrupted":
      return "var(--color-warning)";
    case "connecting":
    case "transcribing":
      return "#3b82f6";
    default:
      return "var(--color-primary)";
  }
}

function iconFor(status: AgentStatus, recording: boolean) {
  if (status === "connecting") return <Wifi className="w-7 h-7 animate-pulse" aria-hidden="true" />;
  if (status === "interrupted") return <Square className="w-7 h-7" aria-hidden="true" />;
  if (recording || status === "listening" || status === "transcribing") return <Mic className="w-7 h-7" aria-hidden="true" />;
  if (status === "speaking") return <Activity className="w-7 h-7" aria-hidden="true" />;
  if (status === "permission-pending") return <ShieldCheck className="w-7 h-7" aria-hidden="true" />;
  if (status === "error") return <TriangleAlert className="w-7 h-7" aria-hidden="true" />;
  return <Sparkles className="w-7 h-7" aria-hidden="true" />;
}

export default function Orb({ status, levelRef, recording }: OrbProps) {
  const pulseRef = useRef<HTMLDivElement>(null);
  const color = colorFor(status);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (pulseRef.current) {
        const level = Math.min(1, Math.max(0, levelRef.current));
        const scale = 1 + level * 0.24;
        pulseRef.current.style.transform = `scale(${scale.toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      role="status"
      aria-live="polite"
      aria-label={`AURA status: ${STATUS_LABEL[status]}`}
    >
      <div className="relative h-44 w-44 md:h-56 md:w-56">
        <div
          className="orb-ring orb-pulse inset-0"
          style={{ borderColor: color }}
          aria-hidden="true"
        />
        <div
          className="orb-ring inset-3 opacity-60 glow-ring"
          style={{ borderColor: color }}
          aria-hidden="true"
        />
        <div
          ref={pulseRef}
          className="absolute inset-10 rounded-full flex items-center justify-center transition-[background-color,border-color] duration-300 text-background"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 42px ${color}`,
          }}
        >
          {iconFor(status, recording)}
        </div>
      </div>
      <p className="mt-5 font-heading text-sm tracking-[0.22em] uppercase text-foreground/90">
        <span
          className="inline-block h-2 w-2 rounded-full mr-2 align-middle"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {STATUS_LABEL[status]}
      </p>
    </div>
  );
}