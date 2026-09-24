import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import type { PermissionRequest } from "../lib/orchestrator";

interface PermissionBarProps {
  request: PermissionRequest;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

/**
 * WRITE/DESTRUCTIVE gate. Modal dialog semantics (role=dialog, aria-modal,
 * focus moves to Approve, Escape denies, focus restored on close).
 */
export default function PermissionBar({ request, onApprove, onDeny }: PermissionBarProps) {
  const approveRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    approveRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDeny(request.id);
      }
      if (e.key === "Tab") {
        // tiny two-button trap: wrap between Deny and Approve
        const focusables = [cancelRef.current, approveRef.current].filter(
          (el): el is HTMLButtonElement => el !== null,
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, [request.id, onDeny]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onDeny(request.id)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-title"
        className="relative w-full max-w-md rounded-xl border border-warning/40 bg-surface p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="perm-title" className="font-heading text-base font-semibold text-foreground">
              Approve {request.label.toLowerCase()} action?
            </h2>
            <p className="mt-1 text-xs font-mono mono-tick text-muted">
              Tool: <span className="text-foreground">{request.tool}</span> · level{" "}
              {request.label}
            </p>
            <p className="mt-2 text-sm text-muted">{request.description}</p>
          </div>
        </div>
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed text-foreground/85 thin-scroll">
          {Object.keys(request.args).length > 0
            ? JSON.stringify(request.args, null, 2)
            : "// no arguments"}
        </pre>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={() => onDeny(request.id)}
            className="btn-press cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-ring/50"
          >
            Deny
          </button>
          <button
            ref={approveRef}
            onClick={() => onApprove(request.id)}
            className="btn-press cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Approve
            <span className="sr-only">(or press Esc to deny)</span>
          </button>
        </div>
      </div>
    </div>
  );
}