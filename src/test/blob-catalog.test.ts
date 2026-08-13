import { describe, it, expect, vi } from "vitest";
import {
  SHM_STATE_DIR,
  UI_MODEL_PLUGINS_PATH,
  UI_MODEL_STATE_PATH,
  loadCatalogPluginIds,
  mergeCatalogIds,
  pluginIdsFromJson,
} from "@/lib/blob-catalog";

describe("plugin catalog sources", () => {
  it("names the live SHM state dir, not the deprecated projections dir", () => {
    expect(SHM_STATE_DIR).toBe("/dev/shm/opdbus/state");
    expect(SHM_STATE_DIR).not.toContain("projections");
    expect(UI_MODEL_PLUGINS_PATH).toBe("/ui-model/plugins");
    expect(UI_MODEL_STATE_PATH).toBe("/ui-model/state");
  });

  it("reads plugin ids from a blob catalog body and a state-tree map", () => {
    expect(pluginIdsFromJson({ plugins: ["antigravity", "cron"] })).toEqual([
      "antigravity",
      "cron",
    ]);
    expect(
      pluginIdsFromJson({
        zeroclaw: { selected_model: "qwen3.6-35b-a3b" },
        "system.memory": { rss: 1 },
      }),
    ).toEqual(["system.memory", "zeroclaw"]);
    expect(
      pluginIdsFromJson({
        plugins: ["zeroclaw", "system.memory"],
        state: {
          zeroclaw: { selected_model: "qwen3.6-35b-a3b" },
          "system.memory": { rss: 1 },
        },
      }),
    ).toEqual(["system.memory", "zeroclaw"]);
  });

  it("unions blob ids with /dev/shm/opdbus/state ids", () => {
    expect(
      mergeCatalogIds(["antigravity", "cron"], ["zeroclaw", "cron", "system.memory"]),
    ).toEqual(["antigravity", "cron", "system.memory", "zeroclaw"]);
  });

  it("loads blobs and SHM state, and never calls the deprecated projection API", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/ui-model/plugins")) {
        return jsonOk({ plugins: ["antigravity", "cron"] });
      }
      if (url.includes("/ui-model/state")) {
        return jsonOk({
          plugins: ["system.memory", "zeroclaw"],
          state: {
            zeroclaw: { selected_model: "qwen3.6-35b-a3b" },
            "system.memory": { rss: 1 },
          },
        });
      }
      return jsonOk({}, 404);
    });

    await expect(loadCatalogPluginIds(fetchFn, "/api")).resolves.toEqual([
      "antigravity",
      "cron",
      "system.memory",
      "zeroclaw",
    ]);

    const urls = fetchFn.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("/ui-model/plugins"))).toBe(true);
    expect(urls.some((u) => u.includes("/ui-model/state"))).toBe(true);
    expect(urls.some((u) => u.includes("projection"))).toBe(false);
    expect(urls.some((u) => u.includes("/dashboard/projections"))).toBe(false);
  });

  it("keeps the blob catalog when SHM state is unavailable", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/ui-model/plugins")) {
        return jsonOk({ plugins: ["antigravity"] });
      }
      return jsonOk({ error: "not found" }, 404);
    });
    await expect(loadCatalogPluginIds(fetchFn, "/api")).resolves.toEqual(["antigravity"]);
  });
});

function jsonOk(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  } as unknown as Response;
}
