import { create } from "zustand";
import type { HealthSnapshot, LogEntry, Agent, EventLogEntry, SseEventType } from "@/types/api";

interface EventStore {
  connected: boolean;
  health: HealthSnapshot | null;
  logs: LogEntry[];
  agents: Agent[];
  events: EventLogEntry[];
  lastError: string | null;
  eventCounts: Record<string, number>;
  latestState: Record<string, unknown>;
  latestStats: Record<string, unknown> | null;

  /**
   * Sealed contract per plugin id, hydrated from the StateSync stream.
   *
   * This is the active catalog as the bridge published it — a plugin exists iff
   * it has a sealed blob, so a plugin present here is a plugin that exists. The
   * schema is the exact JSON that was sealed; nothing re-reads SHM or re-hashes.
   */
  schemas: Record<string, unknown>;
  /** Contract hash per plugin id, alongside `schemas`. */
  schemaHashes: Record<string, string>;
  /** Catalog identity as of the last frame received, from any frame type. */
  catalogHash: string;
  /**
   * Plugins whose value frames cite a contract we are not holding — the visible
   * symptom of a dropped contract frame. Re-hydrate rather than render against
   * a contract known to be wrong.
   */
  staleSchemas: string[];

  setConnected: (v: boolean) => void;
  setHealth: (h: HealthSnapshot) => void;
  addLog: (entry: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  setAgents: (agents: Agent[]) => void;
  addEvent: (event: EventLogEntry) => void;
  setError: (err: string | null) => void;
  clearLogs: () => void;
  updateState: (key: string, value: unknown) => void;
  setStats: (stats: Record<string, unknown>) => void;
  incrementEventCount: (type: SseEventType) => void;
  /** Record a contract. A reseal supersedes rather than accumulates. */
  updateSchema: (pluginId: string, schemaHash: string, schema: unknown) => void;
  /** Advance the catalog identity; empty values are ignored. */
  noteCatalogHash: (hash: string) => void;
  /** Flag a plugin whose frames cite a contract we never received. */
  markSchemaStale: (pluginId: string) => void;
}

const MAX_LOGS = 1000;
const MAX_EVENTS = 500;

export const useEventStore = create<EventStore>((set) => ({
  connected: false,
  health: null,
  logs: [],
  agents: [],
  events: [],
  lastError: null,
  eventCounts: {},
  latestState: {},
  latestStats: null,
  schemas: {},
  schemaHashes: {},
  catalogHash: "",
  staleSchemas: [],

  setConnected: (connected) => set({ connected }),
  setHealth: (health) => set({ health }),
  addLog: (entry) => set((s) => ({ logs: [...s.logs, entry].slice(-MAX_LOGS) })),
  setLogs: (logs) => set({ logs }),
  setAgents: (agents) => set({ agents }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event].slice(-MAX_EVENTS) })),
  setError: (lastError) => set({ lastError }),
  clearLogs: () => set({ logs: [] }),
  updateState: (key, value) => set((s) => ({
    latestState: { ...s.latestState, [key]: value },
  })),
  setStats: (stats) => set({ latestStats: stats }),
  incrementEventCount: (type) => set((s) => ({
    eventCounts: { ...s.eventCounts, [type]: (s.eventCounts[type] || 0) + 1 },
  })),
  updateSchema: (pluginId, schemaHash, schema) => set((s) => ({
    schemas: { ...s.schemas, [pluginId]: schema },
    schemaHashes: { ...s.schemaHashes, [pluginId]: schemaHash },
    // Receiving the contract is what clears the staleness it caused.
    staleSchemas: s.staleSchemas.filter((id) => id !== pluginId),
  })),
  noteCatalogHash: (hash) => set((s) => (hash && hash !== s.catalogHash ? { catalogHash: hash } : s)),
  markSchemaStale: (pluginId) => set((s) => (
    s.staleSchemas.includes(pluginId)
      ? s
      : { staleSchemas: [...s.staleSchemas, pluginId] }
  )),
}));
