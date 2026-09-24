import { useRef, useState, type KeyboardEvent, type FormEvent } from "react";
import {
  Activity,
  Brain,
  CornerDownLeft,
  Cpu,
  FileText,
  Gauge,
  Lock,
  Mic,
  MicOff,
  Send,
  Settings,
  Sparkles,
  Square,
  Wrench,
} from "lucide-react";
import Orb, { STATUS_LABEL } from "./components/Orb";
import ActivityFeed from "./components/ActivityFeed";
import Panels, { type PanelTab } from "./components/Panels";
import PermissionBar from "./components/PermissionBar";
import { useAura } from "./hooks/useAura";
import { BRAND } from "./lib/envConfig";

const TABS: { id: PanelTab; label: string; icon: typeof Activity }[] = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "amd", label: "AMD", icon: Cpu },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "settings", label: "Settings", icon: Settings },
];

const EXAMPLES = [
  "What time is it?",
  "2.5 * 4 + 1",
  "Find the unfinished tasks",
  "Search my docs for the latest requirements",
  "remember that I prefer short answers",
  "Recall my memory",
  "Prepare a summary for the team",
];

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour12: false });
}

export default function App() {
  const aura = useAura();
  const {
    status,
    messages,
    activity,
    permission,
    settings,
    updateSettings,
    micState,
    micIssue,
    micSpeaking,
    micSupported,
    levelRef,
    send,
    startMic,
    stopMic,
    clearConversation,
    probeNow,
    approvePermission,
    denyPermission,
    stopSpeaking,
    memories,
    refreshMemories,
  } = aura;

  const [input, setInput] = useState("");
  const [tab, setTab] = useState<PanelTab>("activity");
  const [pttActive, setPttActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  const onExample = (ex: string) => {
    setInput(ex);
    inputRef.current?.focus();
  };

  const pttStart = () => {
    if (!micSupported) return;
    setPttActive(true);
    void startMic();
  };
  const pttEnd = () => {
    if (!pttActive) return;
    setPttActive(false);
    stopMic();
  };

  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.id === tab);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  };

  const previewTicks = [
    { label: "Env probe", value: aura.envProbeMs !== null ? `${aura.envProbeMs} ms` : "—" },
    {
      label: "Avg tool",
      value:
        aura.toolRuns.length > 0
          ? `${Math.round(aura.toolRuns.reduce((a, b) => a + b.ms, 0) / aura.toolRuns.length)} ms`
          : "—",
    },
    {
      label: "Avg response",
      value:
        aura.responseLatencies.length > 0
          ? `${Math.round(
              aura.responseLatencies.reduce((a, b) => a + b, 0) / aura.responseLatencies.length,
            )} ms`
          : "—",
    },
  ]; 

  const engineChip = aura.env?.backend === "local-amd" ? "AssemblyAI + AMD ROCm" : "AssemblyAI Realtime Engine";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* header */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="glow-ring flex h-9 w-9 items-center justify-center rounded-lg border border-primary/50 bg-primary/15">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold tracking-wide">{BRAND.name}</h1>
              <p className="text-[0.6875rem] text-muted">{BRAND.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="mono-tick hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary sm:inline-flex">
              <Lock className="h-3 w-3" aria-hidden="true" /> LOCAL ONLY
            </span>
            <span
              className={`mono-tick inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-foreground ${
                status === "error"
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface/60"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === "speaking" || status === "listening" || status === "thinking"
                    ? "animate-pulse bg-primary"
                    : status === "error"
                      ? "bg-accent"
                      : "bg-success"
                }`}
                aria-hidden="true"
              />
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* left: orb + conversation + composer */}
        <section className="flex min-w-0 flex-col gap-4" aria-label="AURA conversation">
          <div className="flex flex-col items-center gap-2 pt-1">
            <Orb status={status} levelRef={levelRef} recording={micState === "recording"} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="mono-tick rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">
                engine: {engineChip}
              </span>
              <span className="mono-tick rounded-full border border-border bg-surface/50 px-2.5 py-1 text-muted">
                mic: {micState === "recording" ? (micSpeaking ? "voice" : "listening") : micState}
              </span>
              {micSpeaking ? (
                <span className="mono-tick rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary">
                  VAD: speech
                </span>
              ) : null}
            </div>
          </div>

          {/* transcript */}
          <div
            className="panel thin-scroll flex h-[380px] min-h-0 flex-col gap-3 overflow-y-auto p-4 md:h-[430px]"
            aria-label="Conversation transcript"
          >
            {aura.partialTranscript ? (
              <div className="msg-in flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-primary/50 bg-primary/20 p-3 text-sm italic text-foreground animate-pulse">
                  <span className="mono-tick mr-2 text-[0.625rem] not-italic text-primary">LIVE STT:</span>
                  {aura.partialTranscript}
                </div>
              </div>
            ) : null}

            {messages.length === 0 && !aura.partialTranscript ? (
              <div className="m-auto max-w-sm space-y-3 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-primary/60" aria-hidden="true" />
                <p className="text-sm text-muted">
                  Speak or type a request. AURA plans, picks a tool, verifies the result, then
                  answers — out loud if you like.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                if (m.role === "system") {
                  return (
                    <div key={m.id} className="msg-in my-1 flex justify-center">
                      <span className="mono-tick rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[0.6875rem] text-primary/90">
                        {m.text}
                      </span>
                    </div>
                  );
                }
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`msg-in flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "rounded-tr-sm border border-primary/30 bg-primary/15 text-foreground"
                          : "rounded-tl-sm border border-border bg-surface/70 text-foreground"
                      }`}
                    >
                      {m.text.split("\n").map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                          {line}
                        </p>
                      ))}
                      <p
                        className={`mt-1.5 font-mono text-[0.625rem] ${
                          isUser ? "text-primary/70" : "text-muted/70"
                        }`}
                      >
                        {timeOf(m.at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* composer */}
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-surface/60 p-2 focus-within:border-ring/50"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={pttActive ? "Release to stop recording" : "Hold to talk"}
                onPointerDown={pttStart}
                onPointerUp={pttEnd}
                onPointerLeave={pttEnd}
                onPointerCancel={pttEnd}
                disabled={!micSupported}
                className={`btn-press flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  micState === "recording"
                    ? "border-accent bg-accent/15 text-accent glow-red"
                    : "border-border text-foreground hover:border-ring/50"
                }`}
              >
                {micState === "recording" ? (
                  <MicOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">Hold to talk</span>
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask or command AURA… (e.g. “2.5 * 4 + 1”)"
                aria-label="Message AURA"
                className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted/60"
              />
              <button
                type="submit"
                aria-label="Send message"
                className="btn-press flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-background hover:opacity-90"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between px-1 pt-1.5">
              <p className="text-[0.6875rem] text-muted">
                <CornerDownLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Hold mic to talk · type to command
              </p>
              {status === "speaking" ? (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="btn-press flex cursor-pointer items-center gap-1 rounded-md text-[0.6875rem] text-primary hover:text-primary/80"
                >
                  <Square className="h-3 w-3" aria-hidden="true" /> Stop
                </button>
              ) : null}
            </div>
          </form>

          {/* mic problem / hints */}
          {micIssue ? (
            <p role="alert" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
              {micIssue.message}
            </p>
          ) : null}
          {micSupported ? null : (
            <p className="text-xs text-muted">
              This browser doesn’t expose a microphone — you can still type. Voice features need
              Chrome, Edge, Safari or Firefox on desktop.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onExample(ex)}
                className="btn-press cursor-pointer rounded-full border border-border bg-surface/40 px-3 py-1.5 text-xs text-muted hover:border-ring/50 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </section>

        {/* right: observability panel */}
        <aside className="min-w-0" aria-label="Observability panel">
          <div className="rounded-2xl border border-border/70 bg-surface/40 p-3">
            <div role="tablist" aria-label="AURA panels" onKeyDown={onTabsKeyDown} className="flex flex-wrap gap-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    id={`tab-${t.id}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`panel-${t.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTab(t.id)}
                    className={`btn-press flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors duration-200 ${
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted hover:bg-surface-2/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="thin-scroll max-h-[62vh] overflow-y-auto p-2"
            >
              {tab === "activity" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {previewTicks.map((s) => (
                      <div key={s.label} className="rounded-lg border border-border/60 bg-surface/40 px-2 py-1.5">
                        <p className="mono-tick text-[0.625rem] text-muted">{s.label}</p>
                        <p className="font-mono text-sm tabular-nums text-foreground">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <ActivityFeed items={activity} />
                </div>
              ) : (
                <Panels
                  tab={tab}
                  env={aura.env}
                  envProbeMs={aura.envProbeMs}
                  toolRuns={aura.toolRuns}
                  verifications={aura.verifications}
                  ttsRuns={aura.ttsRuns}
                  responseLatencies={aura.responseLatencies}
                  settings={settings}
                  updateSettings={updateSettings}
                  messages={messages}
                  onClearConversation={clearConversation}
                  memories={memories}
                  refreshMemories={refreshMemories}
                  micSupported={micSupported}
                  onProbeNow={probeNow}
                  onStopSpeaking={stopSpeaking}
                />
              )}
            </div>
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 md:px-6">
        <p className="mono-tick text-[0.625rem] text-muted/70">
          AURA — local-first voice agent. {BRAND.tagline}. No cloud, no telemetry, no fabricated
          metrics.
        </p>
      </footer>

      {permission ? (
        <PermissionBar
          request={permission}
          onApprove={approvePermission}
          onDeny={denyPermission}
        />
      ) : null}
    </div>
  );
}