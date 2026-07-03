/**
 * Polls `grpc.reflection.v1.ServerReflection` and keeps a snapshot of every
 * service + method + message currently registered on the bridge. Refresh runs
 * on mount, on a manual `refresh()`, and on an interval so newly-minted
 * D-Bus-backed plugin services appear without a page reload.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listServices,
  fileContainingSymbol,
  type ReflectedFile,
  type ReflectedService,
  type ReflectedMessage,
} from "@/lib/reflection/client";

export interface ReflectionRegistry {
  files: ReflectedFile[];
  services: ReflectedService[];
  messages: Map<string, ReflectedMessage>;
}

interface State {
  registry: ReflectionRegistry | null;
  loading: boolean;
  error: string | null;
  lastSyncAt: number | null;
  addedSinceLast: string[];
  removedSinceLast: string[];
}

const EMPTY: ReflectionRegistry = { files: [], services: [], messages: new Map() };

export function useReflectionRegistry(pollMs = 5000) {
  const [state, setState] = useState<State>({
    registry: null,
    loading: true,
    error: null,
    lastSyncAt: null,
    addedSinceLast: [],
    removedSinceLast: [],
  });
  const prevServicesRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const serviceNames = await listServices();
      // Fetch each file descriptor in parallel. Some services share files —
      // `fileContainingSymbol` returns the whole file tree; we dedupe.
      const results = await Promise.allSettled(
        serviceNames.map((s) => fileContainingSymbol(s)),
      );
      const fileMap = new Map<string, ReflectedFile>();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const f of r.value) if (!fileMap.has(f.fileName)) fileMap.set(f.fileName, f);
      }
      const files = [...fileMap.values()].sort((a, b) => a.fileName.localeCompare(b.fileName));
      const services = files.flatMap((f) => f.services).sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      );
      const messages = new Map<string, ReflectedMessage>();
      for (const f of files) for (const m of f.messages) messages.set(m.fullName, m);

      const nowSet = new Set(services.map((s) => s.fullName));
      const prev = prevServicesRef.current;
      const added = [...nowSet].filter((n) => !prev.has(n));
      const removed = [...prev].filter((n) => !nowSet.has(n));
      prevServicesRef.current = nowSet;

      setState({
        registry: { files, services, messages },
        loading: false,
        error: null,
        lastSyncAt: Date.now(),
        addedSinceLast: added,
        removedSinceLast: removed,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: (e as Error)?.message ?? String(e),
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    if (pollMs <= 0) return;
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return useMemo(
    () => ({
      registry: state.registry ?? EMPTY,
      loading: state.loading,
      error: state.error,
      lastSyncAt: state.lastSyncAt,
      addedSinceLast: state.addedSinceLast,
      removedSinceLast: state.removedSinceLast,
      refresh,
    }),
    [state, refresh],
  );
}
