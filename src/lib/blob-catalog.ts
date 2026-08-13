/**
 * Plugin catalog ids for Blobs / Plugins pages.
 *
 * Two live SHM sources. The projection daemon is gone; op-web serves state
 * from `/dev/shm/opdbus/state/` on GET /ui-model/state (and still aliases the
 * old /dashboard/projections path to that handler).
 *
 *   - sealed blobs: GET /ui-model/plugins  → /dev/shm/opdbus/plugin-blobs/
 *   - present state: GET /ui-model/state   → /dev/shm/opdbus/state/
 */
import { resolveApiBase } from "@/lib/api";

export const SHM_STATE_DIR = "/dev/shm/opdbus/state";
export const SHM_BLOB_DIR = "/dev/shm/opdbus/plugin-blobs";
export const UI_MODEL_PLUGINS_PATH = "/ui-model/plugins";
export const UI_MODEL_STATE_PATH = "/ui-model/state";

const SKIP_KEYS = new Set([
  "error",
  "success",
  "version",
  "ok",
  "generation",
  "catalog",
  "total",
  "schema",
  "schema_hash",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function objectKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => key.length > 0 && !key.startsWith(".") && !SKIP_KEYS.has(key));
}

/** Extract plugin ids from a blob catalog body or a SHM state-tree map. */
export function pluginIdsFromJson(raw: unknown): string[] {
  if (Array.isArray(raw)) return mergeCatalogIds(stringIds(raw));
  if (!isRecord(raw)) return [];

  const ids: string[] = [];
  ids.push(...stringIds(raw.plugins));
  if (Array.isArray(raw.state)) {
    ids.push(...stringIds(raw.state));
  } else if (isRecord(raw.state)) {
    ids.push(...objectKeys(raw.state));
  }

  if (ids.length === 0) {
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith(".") || SKIP_KEYS.has(key)) continue;
      if (value !== null && typeof value === "object") ids.push(key);
    }
  }

  return mergeCatalogIds(ids);
}

export function mergeCatalogIds(...groups: Array<readonly string[]>): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group) {
      const trimmed = id.trim();
      if (trimmed && !trimmed.startsWith(".")) ids.add(trimmed);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

async function readJson(
  fetchFn: typeof fetch,
  url: string,
): Promise<{ ok: boolean; status: number; contentType: string; body: unknown }> {
  const res = await fetchFn(url);
  const contentType = res.headers.get("content-type") ?? "";
  let body: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }
  return { ok: res.ok, status: res.status, contentType, body };
}

/**
 * Load catalog plugin ids from sealed blobs plus `/dev/shm/opdbus/state/`.
 * A missing state listing is non-fatal; a missing blob catalog is not.
 */
export async function loadCatalogPluginIds(
  fetchFn: typeof fetch = fetch,
  apiBase: string = resolveApiBase(),
): Promise<string[]> {
  const blobUrl = `${apiBase}${UI_MODEL_PLUGINS_PATH}`;
  const stateUrl = `${apiBase}${UI_MODEL_STATE_PATH}`;

  const blob = await readJson(fetchFn, blobUrl);
  if (!blob.ok) throw new Error(`catalog HTTP ${blob.status}`);
  if (!blob.contentType.includes("application/json")) {
    throw new Error(
      `catalog returned ${blob.contentType || "unknown type"}, not JSON — check the API base`,
    );
  }
  if (!isRecord(blob.body) || !Array.isArray(blob.body.plugins)) {
    throw new Error("catalog response has no `plugins` array");
  }

  const blobIds = pluginIdsFromJson(blob.body);

  let stateIds: string[] = [];
  try {
    const state = await readJson(fetchFn, stateUrl);
    if (state.ok && state.contentType.includes("application/json")) {
      stateIds = pluginIdsFromJson(state.body);
    }
  } catch {
    // Present-state listing is additive; blobs still render if SHM state is down.
  }

  return mergeCatalogIds(blobIds, stateIds);
}
