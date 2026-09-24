/** Public (non-secret) configuration. This build intentionally stores no secrets. */

export const BRAND = {
  name: "AURA",
  tagline: "Autonomous Voice Utility & Response Agent",
} as const;

export const DEFAULT_LOCAL_API_BASE = "http://localhost:8008";

/**
 * Base URL of the local AMD backend (FastAPI lane, see docs/amd-rocm-blueprint.md).
 * Read from VITE_LOCAL_API_URL — see the Env vars panel to override; defaults to
 * localhost:8000 so the app works out of the box on the user's machine.
 */
export function apiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_LOCAL_API_URL as string | undefined;
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : DEFAULT_LOCAL_API_BASE;
}

/** Privacy-first: this build is LOCAL ONLY. Cloud inference is disabled by design. */
export const CLOUD_ENABLED = false;

export const STORAGE_KEYS = {
  settings: "aura.settings.v1",
} as const;