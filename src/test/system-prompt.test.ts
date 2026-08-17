import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_TUNABLE_PROMPT,
  IMMUTABLE_PROMPT,
  getTunableSystemPrompt,
  setTunableSystemPrompt,
  clearTunableSystemPrompt,
  getEffectiveSystemPrompt,
} from "@/lib/system-prompt";

describe("system-prompt storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults tunable when unset", () => {
    expect(getTunableSystemPrompt()).toBe(DEFAULT_TUNABLE_PROMPT);
  });

  it("persists and reloads tunable preferences", () => {
    setTunableSystemPrompt("## custom\nok");
    expect(getTunableSystemPrompt()).toBe("## custom\nok");
  });

  it("clears back to defaults", () => {
    setTunableSystemPrompt("x");
    clearTunableSystemPrompt();
    expect(getTunableSystemPrompt()).toBe(DEFAULT_TUNABLE_PROMPT);
  });

  it("builds effective prompt from immutable + tunable", () => {
    const effective = getEffectiveSystemPrompt("## prefs");
    expect(effective.startsWith(IMMUTABLE_PROMPT)).toBe(true);
    expect(effective.endsWith("## prefs")).toBe(true);
  });
});
