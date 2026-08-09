import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, resolveIdentity } from "@/lib/identity";

afterEach(() => {
  clearSession();
  delete window.__OPDBUS_CONFIG__;
  vi.unstubAllGlobals();
});

describe("identity resolution", () => {
  it("refreshes from the live sled before using a build-time fallback", async () => {
    clearSession();
    delete window.__OPDBUS_CONFIG__;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        is_valid: true,
        hashed_footprint: "ab".repeat(32),
        trace_id: "cd".repeat(16),
      }),
    }));

    const status = await resolveIdentity();

    expect(status.state).toBe("ready");
    if (status.state === "ready") {
      expect(status.identity.source).toBe("sled");
      expect(status.identity.hashed_footprint).toBe("ab".repeat(32));
    }
  });
});
