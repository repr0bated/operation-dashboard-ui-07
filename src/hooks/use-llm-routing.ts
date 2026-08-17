import { useCallback, useEffect, useState } from "react";
import { resolveApiBase } from "@/lib/api";

/**
 * Live LLM routing state. No mock data: when the control plane cannot answer,
 * the error is surfaced rather than substituted with plausible-looking models.
 *
 * Sources:
 *   GET /api/llm/status              → active provider + model
 *   GET /api/llm/providers           → registered providers + current
 *   GET /api/llm/models[?provider=]  → routable models (tched_router projection by
 *                                      default; 503 when unavailable)
 */

export interface LlmStatus {
  provider: string;
  model: string;
  model_non_sandboxed?: boolean;
  available?: boolean;
  available_providers?: string[];
}

export interface RoutableModel {
  id: string;
  name?: string;
  description?: string | null;
  parameters?: string | null;
  available?: boolean;
  tags?: string[];
}

export interface LlmRouting {
  status: LlmStatus | null;
  providers: string[];
  currentProvider: string | null;
  models: RoutableModel[];
  /** Which provider the model list came from. */
  modelSource: string | null;
  loading: boolean;
  /** Fatal error fetching provider/status data. */
  error: string | null;
  /** Non-fatal: providers are known but the model projection is unavailable. */
  modelsError: string | null;
  refresh: () => void;
}

async function getJson(path: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${resolveApiBase()}${path}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    // HTML here means the request fell through to the SPA fallback.
    throw new Error(
      `${path} returned ${ct || "unknown type"}, not JSON — check the API base`,
    );
  }
  return { ok: res.ok, status: res.status, body: await res.json() };
}

export function useLlmRouting(providerFilter?: string): LlmRouting {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [models, setModels] = useState<RoutableModel[]>([]);
  const [modelSource, setModelSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setModelsError(null);

      // Provider + status are the authoritative pair; a failure here is fatal.
      try {
        const [statusRes, providersRes] = await Promise.all([
          getJson("/llm/status"),
          getJson("/llm/providers"),
        ]);
        if (cancelled) return;

        if (statusRes.ok) setStatus(statusRes.body as LlmStatus);
        else throw new Error(`/llm/status HTTP ${statusRes.status}`);

        if (!providersRes.ok) throw new Error(`/llm/providers HTTP ${providersRes.status}`);
        const p = providersRes.body as { providers?: string[]; current?: string };
        setProviders(Array.isArray(p.providers) ? p.providers : []);
        setCurrentProvider(p.current ?? null);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
        return;
      }

      // Models are best-effort: the tched_router projection is often unavailable.
      try {
        const qs = providerFilter ? `?provider=${encodeURIComponent(providerFilter)}` : "";
        const res = await getJson(`/llm/models${qs}`);
        if (cancelled) return;

        const body = res.body as {
          models?: RoutableModel[];
          provider?: string;
          error?: string;
        };
        setModels(Array.isArray(body.models) ? body.models : []);
        setModelSource(body.provider ?? null);
        if (!res.ok || body.error) {
          setModelsError(body.error ?? `/llm/models HTTP ${res.status}`);
        }
      } catch (e) {
        if (!cancelled) {
          setModels([]);
          setModelsError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerFilter, nonce]);

  return {
    status,
    providers,
    currentProvider,
    models,
    modelSource,
    loading,
    error,
    modelsError,
    refresh,
  };
}
