import { describe, expect, it, vi, afterEach } from "vitest";
import { probeLocalAmd } from "./localAmd";

describe("probeLocalAmd", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("handles backend with status READY and active ROCm GPU", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "READY",
        backend: "local-amd-rocm",
        rocm_available: true,
        rocm: "HIP 6.0",
        gpus: ["AMD Radeon RX 7900 XTX"],
        driver: "PyTorch ROCm",
        model: "local-amd-rocm-q4",
        reason: "AMD ROCm hardware acceleration is active and operational.",
      }),
    } as Response);

    const probe = await probeLocalAmd("http://localhost:8008");
    expect(probe.backend).toBe("local-amd");
    expect(probe.amd?.rocm).toBe("HIP 6.0");
    expect(probe.amd?.gpus).toEqual(["AMD Radeon RX 7900 XTX"]);
  });

  it("handles backend with status READY and CPU deterministic fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "READY",
        backend: "local-cpu-deterministic",
        rocm_available: false,
        reason: "AMD acceleration unavailable in current environment.",
      }),
    } as Response);

    const probe = await probeLocalAmd("http://localhost:8008");
    expect(probe.backend).toBe("none");
    expect(probe.reason).toBe("AMD acceleration unavailable in current environment.");
  });

  it("handles network unreachable error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const probe = await probeLocalAmd("http://localhost:8008");
    expect(probe.backend).toBe("none");
    expect(probe.reason).toBe("local backend is not reachable on this machine");
  });
});
