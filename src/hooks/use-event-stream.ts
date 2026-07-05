import { useEffect, useRef } from "react";
import { stateSync, eventChainService, ovsdbMirror, runtimeMirror, componentRegistry } from "@/grpc/client";
import { useEventStore } from "@/stores/event-store";
import type { StateChange, ChainEvent, OvsdbUpdate, RuntimeMetricUpdate } from "@/grpc/types/operation";
import type { RegistryEvent } from "@/grpc/types/registry";
import { structToObject, valueToJs } from "@/grpc/google/protobuf/struct";

/**
 * Subscribes to all live gRPC-Web server-streams from the operation gateway:
 *   1. StateSync.Subscribe          — D-Bus property changes → latestState
 *   2. EventChain.SubscribeEvents   — Audit ledger → events[]
 *   3. OvsdbMirror.Monitor          — OVS bridge/port/interface changes → latestState
 *   4. RuntimeMirror.StreamMetrics  — CPU/memory/network metrics → latestStats
 *   5. ComponentRegistry.Watch      — agent/component discovery → latestState.agents
 *
 * Each stream auto-reconnects on failure with exponential backoff (capped).
 */

type StreamName = "state" | "chain" | "ovs" | "metrics" | "registry";

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

export function useEventStream() {
  const abortsRef = useRef<Map<StreamName, () => void>>(new Map());
  const timersRef = useRef<Map<StreamName, ReturnType<typeof setTimeout>>>(new Map());
  const backoffRef = useRef<Map<StreamName, number>>(new Map());

  useEffect(() => {
    let mounted = true;

    async function seedFromSnapshots() {
      const store = useEventStore.getState();
      const snapshots: Array<[string, () => Promise<unknown>]> = [
        ["snapshot.state", () => stateSync.getState({ pluginId: "", objectPath: "" })],
        ["snapshot.ovsdb.bridges", () => ovsdbMirror.getBridgeState()],
        ["snapshot.runtime.systemInfo", () => runtimeMirror.getSystemInfo()],
        ["snapshot.runtime.services", () => runtimeMirror.listServices()],
        ["snapshot.runtime.interfaces", () => runtimeMirror.listInterfaces()],
        ["snapshot.runtime.numa", () => runtimeMirror.getNumaTopology()],
        ["snapshot.registry.components", () => componentRegistry.discover()],
      ];

      const results = await Promise.allSettled(snapshots.map(([, fn]) => fn()));
      if (!mounted) return;

      results.forEach((res, idx) => {
        const [key] = snapshots[idx];
        if (res.status === "fulfilled") {
          let value: unknown = res.value;
          try {
            const v = res.value as { state?: unknown };
            if (v && typeof v === "object" && "state" in v && v.state) {
              value = structToObject(v.state as Parameters<typeof structToObject>[0]);
            }
          } catch { /* keep raw */ }
          store.updateState(key, value);
        } else {
          store.updateState(key, { error: (res.reason as Error)?.message ?? String(res.reason) });
        }
      });

      if (results.some((r) => r.status === "fulfilled")) {
        store.setConnected(true);
        store.setError(null);
      } else {
        const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        if (firstErr) store.setError((firstErr.reason as Error)?.message ?? String(firstErr.reason));
      }
    }



    /** Schedule a single-stream reconnect with exponential backoff. */
    function scheduleReconnect(name: StreamName, runner: () => void) {
      if (!mounted) return;
      const prev = backoffRef.current.get(name) ?? INITIAL_BACKOFF_MS;
      const delay = Math.min(prev * 2, MAX_BACKOFF_MS);
      backoffRef.current.set(name, delay);

      const existing = timersRef.current.get(name);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        if (!mounted) return;
        runner();
      }, prev);
      timersRef.current.set(name, t);
    }

    /** Reset backoff after a stream successfully receives data. */
    function noteHealthy(name: StreamName) {
      backoffRef.current.set(name, INITIAL_BACKOFF_MS);
      useEventStore.getState().setConnected(true);
      useEventStore.getState().setError(null);
    }

    /** Abort any active stream under this name before (re)starting. */
    function abortOne(name: StreamName) {
      const a = abortsRef.current.get(name);
      if (a) { try { a(); } catch { /* ignore */ } }
      abortsRef.current.delete(name);
    }

    // ── 1. StateSync ───────────────────────────────────────────────────────
    function runState() {
      abortOne("state");
      try {
        const { stream, abort } = stateSync.subscribe({ includeInitialState: true });
        abortsRef.current.set("state", abort);
        const reader = stream.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const change = value as StateChange;
              const store = useEventStore.getState();
              const key = change.pluginId
                ? `${change.pluginId}.${change.memberName}`
                : change.memberName;
              store.updateState(key, valueToJs(change.newValue));
              store.addEvent({
                id: change.changeId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                event: "state_update",
                ts: Date.now(),
                payload: change,
              });
              store.incrementEventCount("state_update");
              noteHealthy("state");
            }
          } catch (err) {
            if (mounted && (err as Error).name !== "AbortError") {
              useEventStore.getState().setError(`StateSync stream error: ${(err as Error).message}`);
            }
          } finally {
            if (mounted) scheduleReconnect("state", runState);
          }
        })();
      } catch {
        scheduleReconnect("state", runState);
      }
    }

    // ── 2. EventChain ──────────────────────────────────────────────────────
    function runChain() {
      abortOne("chain");
      try {
        const { stream, abort } = eventChainService.subscribeEvents({ fromEventId: 0 });
        abortsRef.current.set("chain", abort);
        const reader = stream.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const evt = value as ChainEvent;
              const store = useEventStore.getState();
              store.addEvent({
                id: evt.eventHash || `chain-${evt.eventId}`,
                event: "audit_event",
                ts: Date.now(),
                payload: evt,
              });
              store.incrementEventCount("audit_event");
              noteHealthy("chain");
            }
          } catch (err) {
            if (mounted && (err as Error).name !== "AbortError") {
              useEventStore.getState().setError(`EventChain stream error: ${(err as Error).message}`);
            }
          } finally {
            if (mounted) scheduleReconnect("chain", runChain);
          }
        })();
      } catch {
        scheduleReconnect("chain", runChain);
      }
    }

    // ── 3. OvsdbMirror.Monitor ─────────────────────────────────────────────
    function runOvs() {
      abortOne("ovs");
      try {
        const { stream, abort } = ovsdbMirror.monitor({
          database: "Open_vSwitch",
          monitorRequestsJson: JSON.stringify({ Bridge: {}, Port: {}, Interface: {} }),
        });
        abortsRef.current.set("ovs", abort);
        const reader = stream.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const update = value as OvsdbUpdate;
              const store = useEventStore.getState();
              const key = `ovsdb.${update.table}.${update.uuid}`;
              store.updateState(key, update.newRow ? structToObject(update.newRow) : null);
              store.addEvent({
                id: `ovs-${update.uuid}-${Date.now()}`,
                event: "state_update",
                ts: Date.now(),
                payload: update,
              });
              store.incrementEventCount("state_update");
              noteHealthy("ovs");
            }
          } catch (err) {
            if (mounted && (err as Error).name !== "AbortError") {
              useEventStore.getState().setError(`OvsdbMirror stream error: ${(err as Error).message}`);
            }
          } finally {
            if (mounted) scheduleReconnect("ovs", runOvs);
          }
        })();
      } catch {
        scheduleReconnect("ovs", runOvs);
      }
    }

    // ── 4. RuntimeMirror.StreamMetrics ─────────────────────────────────────
    function runMetrics() {
      abortOne("metrics");
      try {
        const { stream, abort } = runtimeMirror.streamMetrics({
          intervalSeconds: 5,
          categories: [],
        });
        abortsRef.current.set("metrics", abort);
        const reader = stream.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const metric = value as RuntimeMetricUpdate;
              const store = useEventStore.getState();
              const current = store.latestStats ?? {};
              const labelKey = Object.values(metric.labels || {}).join(".");
              const metricKey = labelKey
                ? `${metric.category}.${metric.name}.${labelKey}`
                : `${metric.category}.${metric.name}`;
              store.setStats({
                ...current,
                [metricKey]: {
                  value: metric.value,
                  unit: metric.unit,
                  labels: metric.labels,
                  timestamp: metric.timestamp,
                },
              });
              store.incrementEventCount("system_stats");
              noteHealthy("metrics");
            }
          } catch (err) {
            if (mounted && (err as Error).name !== "AbortError") {
              useEventStore.getState().setError(`RuntimeMirror metrics error: ${(err as Error).message}`);
            }
          } finally {
            if (mounted) scheduleReconnect("metrics", runMetrics);
          }
        })();
      } catch {
        scheduleReconnect("metrics", runMetrics);
      }
    }

    // ── 5. ComponentRegistry.Watch ─────────────────────────────────────────
    // Registry status enum: 1=RUNNING, 2=OFFLINE, 3=DEGRADED, others=busy
    const statusToLabel = (s: number | undefined): string => {
      switch (s) {
        case 1: return "running";
        case 2: return "offline";
        case 3: return "degraded";
        default: return "busy";
      }
    };

    function runRegistry() {
      abortOne("registry");
      try {
        const { stream, abort } = componentRegistry.watch({
          componentTypes: [],
          includeExisting: true,
        });
        abortsRef.current.set("registry", abort);
        const reader = stream.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const evt = value as RegistryEvent;
              const store = useEventStore.getState();
              const comp = evt.component;

              if (comp) {
                const existing = (store.latestState["agents"] as Array<Record<string, unknown>>) ?? [];
                const idx = existing.findIndex((a) => a.id === comp.componentId);
                const entry: Record<string, unknown> = {
                  id: comp.componentId,
                  name: comp.name,
                  description: comp.description,
                  status: statusToLabel(comp.status as number | undefined),
                  capabilities: comp.capabilities ?? [],
                  activeSessions: 0,
                  memoryEntries: 0,
                  configSchema: comp.schemaJson
                    ? (() => { try { return JSON.parse(comp.schemaJson); } catch { return {}; } })()
                    : {},
                  configData: comp.metadata ?? {},
                  componentType: comp.componentType,
                  endpoint: comp.endpoint,
                  version: comp.version,
                  lastHeartbeat: comp.lastHeartbeat,
                };

                if (evt.eventType === 2 /* DEREGISTERED */) {
                  store.updateState("agents", existing.filter((a) => a.id !== comp.componentId));
                } else if (idx >= 0) {
                  const updated = [...existing];
                  updated[idx] = entry;
                  store.updateState("agents", updated);
                } else {
                  store.updateState("agents", [...existing, entry]);
                }
              }

              store.addEvent({
                id: `reg-${evt.component?.componentId}-${Date.now()}`,
                event: "registry_event",
                ts: Date.now(),
                payload: evt,
              });
              store.incrementEventCount("registry_event");
              noteHealthy("registry");
            }
          } catch (err) {
            if (mounted && (err as Error).name !== "AbortError") {
              useEventStore.getState().setError(`ComponentRegistry stream error: ${(err as Error).message}`);
            }
          } finally {
            if (mounted) scheduleReconnect("registry", runRegistry);
          }
        })();
      } catch {
        scheduleReconnect("registry", runRegistry);
      }
    }

    // Seed snapshots and start every stream.
    void seedFromSnapshots();
    runState();
    runChain();
    runOvs();
    runMetrics();
    runRegistry();

    return () => {
      mounted = false;
      for (const a of abortsRef.current.values()) {
        try { a(); } catch { /* ignore */ }
      }
      abortsRef.current.clear();
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);
}
