/**
 * Live zeroclaw routing: schemars schema + GetState overlay.
 * Backed by a module-level singleton store so every mounted picker, panel and
 * page observes the same snapshot — a refresh() from any picker updates all of
 * them. When the control plane cannot answer, the error is surfaced — no mock models.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { resolveApiBase } from "@/lib/api";
import {
  EMPTY_ROUTING_STATE,
  loadZeroclawRouting,
  type ZeroclawRoutingSnapshot,
  type ZeroclawRoutingState,
} from "@/lib/zeroclaw-routing";

export interface UseZeroclawRouting {
  snapshot: ZeroclawRoutingSnapshot | null;
  state: ZeroclawRoutingState;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchPluginSchema(): Promise<unknown | undefined> {
  try {
    const response = await fetch(`${resolveApiBase()}/ui-model/plugin-schema/zeroclaw`);
    if (!response.ok) return undefined;
    const body = await response.json();
    return body?.schema ?? body;
  } catch {
    return undefined;
  }
}

interface StoreValue {
  snapshot: ZeroclawRoutingSnapshot | null;
  loading: boolean;
  error: string | null;
}

let value: StoreValue = { snapshot: null, loading: true, error: null };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
let loadedOnce = false;

function emit(next: StoreValue) {
  value = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function load(): Promise<void> {
  if (inFlight) return inFlight;
  emit({ ...value, loading: true, error: null });
  inFlight = (async () => {
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      const pluginSchema = await fetchPluginSchema();
      const next = await loadZeroclawRouting(
        (subid, input) => pluginMethods.callSubid(subid, input ?? {}),
        { pluginSchema },
      );
      emit({ snapshot: next, loading: false, error: null });
    } catch (e) {
      emit({ snapshot: null, loading: false, error: (e as Error).message });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function getSnapshot(): StoreValue {
  return value;
}

export function useZeroclawRouting(): UseZeroclawRouting {
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const refresh = useCallback(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!loadedOnce) {
      loadedOnce = true;
      void load();
    }
  }, []);

  return {
    snapshot: store.snapshot,
    state: store.snapshot?.state ?? EMPTY_ROUTING_STATE,
    loading: store.loading,
    error: store.error,
    refresh,
  };
}
