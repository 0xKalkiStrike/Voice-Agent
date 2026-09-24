import type { EnvProbe } from "../types/providers";

/**
 * Local AMD runtime probe. The AMD lane is a user-run FastAPI backend
 * (docs/amd-rocm-blueprint.md) serving /health + /env-status. On this
 * platform no ROCm device exists, so the probe truthfully reports
 * backend:"none" — the app never pretends GPU inference it isn't doing.
 */

const PROBE_TIMEOUT_MS = 2500;

interface HealthPayload {
  status?: string;
  rocm?: string;
  gpus?: string[];
  driver?: string;
  model?: string;
}

export async function probeLocalAmd(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<EnvProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const onSignalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onSignalAbort, { once: true });
  }
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`health endpoint returned HTTP ${res.status}`);
    const body = (await res.json()) as HealthPayload & {
      backend?: string;
      rocm_available?: boolean;
      reason?: string;
    };
    const statusStr = (body.status ?? "").toLowerCase();
    if (statusStr !== "ok" && statusStr !== "ready") {
      return {
        backend: "none",
        reason: body.reason || "AMD backend reported not ready",
        measuredAt: Date.now(),
      };
    }
    const isAmdActive =
      body.rocm_available === true ||
      body.backend === "local-amd" ||
      body.backend === "local-amd-rocm";

    if (!isAmdActive) {
      return {
        backend: "none",
        reason: body.reason || "AMD acceleration unavailable in current environment.",
        measuredAt: Date.now(),
      };
    }

    return {
      backend: "local-amd",
      amd: {
        rocm: typeof body.rocm === "string" ? body.rocm : undefined,
        gpus: Array.isArray(body.gpus) ? body.gpus : [],
        driver: typeof body.driver === "string" ? body.driver : "unknown",
        modelName: typeof body.model === "string" ? body.model : undefined,
      },
      reason: body.reason,
      measuredAt: Date.now(),
    };
  } catch (err) {
    return { backend: "none", reason: humanReason(err), measuredAt: Date.now() };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onSignalAbort);
  }
}

function humanReason(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "local backend did not respond (timeout)";
  }
  if (err instanceof TypeError) {
    return "local backend is not reachable on this machine";
  }
  if (err instanceof Error && err.message) return err.message;
  return "unknown probe error";
}