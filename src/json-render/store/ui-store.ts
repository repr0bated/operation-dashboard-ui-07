import { createStateStore, type StateStore } from "@json-render/core";
import { toCatalogName } from "@/json-render/catalog/stream-plugins";
import { activeSectionSlug } from "@/json-render/navigation/manifest";

export const INITIAL_UI_STATE = {
  connected: false,
  catalogHash: "",
  plugins: {} as Record<string, Record<string, unknown>>,
  schemas: {} as Record<string, unknown>,
  schemaHashes: {} as Record<string, string>,
  pluginIndex: [] as Array<{ id: string; catalogName: string }>,
  streams: {
    stream_antigravity_01: {
      messages: [
        {
          id: "sys-live",
          role: "system" as const,
          content: "Antigravity Chat — Send goes through ChatService · model from tched_router",
        },
      ],
    },
    stream_accountability_01: {
      messages: [
        {
          id: "sys-acct",
          role: "system" as const,
          content: "Accountability Chat — same catalog, separate thread · episodes from ctl_plane_chatbot",
        },
      ],
    },
    stream_gallery_01: {
      messages: [] as Array<{ id: string; role: "user" | "agent" | "system"; content: string }>,
    },
  },
  shell: {
    route: typeof window !== "undefined" ? window.location.pathname || "/" : "/",
    navCollapsed: false,
    selectedPlugin: null as string | null,
    activeSection:
      typeof window !== "undefined" ? activeSectionSlug(window.location.pathname || "/") : "",
    collapsedSections: {} as Record<string, boolean>,
  },
};

export const uiStore: StateStore = createStateStore(INITIAL_UI_STATE);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { _value: value };
}

function ensurePluginIndex(pluginId: string): void {
  const index = (uiStore.get("/pluginIndex") as Array<{ id: string; catalogName: string }>) ?? [];
  if (index.some((entry) => entry.id === pluginId)) return;
  uiStore.set("/pluginIndex", [...index, { id: pluginId, catalogName: toCatalogName(pluginId) }]);
}

/** Mirror a live StateSync value frame into the json-render state model. */
export function applyPluginValue(
  pluginId: string,
  memberName: string | undefined,
  value: unknown,
): void {
  if (!memberName) {
    uiStore.set(`/plugins/${pluginId}`, asRecord(value));
  } else {
    const current = asRecord(uiStore.get(`/plugins/${pluginId}`) ?? {});
    uiStore.set(`/plugins/${pluginId}`, { ...current, [memberName]: value });
  }
  ensurePluginIndex(pluginId);
}

/** Pin the contract hash from a value frame (does not store the schema body). */
export function noteSchemaHash(pluginId: string, schemaHash: string): void {
  if (!schemaHash) return;
  const hashes = {
    ...((uiStore.get("/schemaHashes") as Record<string, string> | undefined) ?? {}),
  };
  if (hashes[pluginId] === schemaHash) return;
  hashes[pluginId] = schemaHash;
  uiStore.set("/schemaHashes", hashes);
}

/** Mirror a contract (schema) frame — never fold this into plugin state. */
export function applyPluginSchema(pluginId: string, schemaHash: string, schema: unknown): void {
  const schemas = { ...asRecord(uiStore.get("/schemas") ?? {}), [pluginId]: schema };
  const hashes = {
    ...((uiStore.get("/schemaHashes") as Record<string, string> | undefined) ?? {}),
    [pluginId]: schemaHash,
  };
  uiStore.set("/schemas", schemas);
  uiStore.set("/schemaHashes", hashes);
  ensurePluginIndex(pluginId);
}
