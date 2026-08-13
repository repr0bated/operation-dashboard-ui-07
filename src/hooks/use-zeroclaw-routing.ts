/**
 * Live zeroclaw routing: schemars schema + GetState overlay.
 * When the control plane cannot answer, the error is surfaced — no mock models.
 */
import { useCallback, useEffect, useState } from "react";
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

export function useZeroclawRouting(): UseZeroclawRouting {
  const [snapshot, setSnapshot] = useState<ZeroclawRoutingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { pluginMethods } = await import("@/grpc/plugin-methods");
        const pluginSchema = await fetchPluginSchema();
        const next = await loadZeroclawRouting(
          (subid, input) => pluginMethods.callSubid(subid, input ?? {}),
          { pluginSchema },
        );
        if (!cancelled) setSnapshot(next);
      } catch (e) {
        if (!cancelled) {
          setSnapshot(null);
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    snapshot,
    state: snapshot?.state ?? EMPTY_ROUTING_STATE,
    loading,
    error,
    refresh,
  };
}
