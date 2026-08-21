import { useCallback, useEffect, useState } from "react";
import { valueToJs } from "@/grpc/google/protobuf/struct";

/**
 * Live LLM routing state, read from the tched_router plugin over the gRPC
 * bridge (there is no /llm REST projection on this deployment). No mock data:
 * when the control plane cannot answer, the error is surfaced rather than
 * substituted with plausible-looking models.
 *
 * Sources (plugin method subids):
 *   obs.service.tched-router.router.get@v1      → active provider + model
 *   obs.service.tched-router.providers.list@v1  → registered providers
 *   obs.service.tched-router.models.list@v1     → routable models for one
 *                                                  provider (the selected one)
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
  provider?: string;
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
  /** Non-fatal: providers are known but the model list is unavailable. */
  modelsError: string | null;
  refresh: () => void;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** A ListProviders entry may be a bare id or an object keyed a few ways. */
function parseProviderId(entry: unknown): string | undefined {
  const v = valueToJs(entry);
  if (typeof v === "string") return asString(v);
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  return asString(o.id ?? o.provider_id ?? o.providerId ?? o.name);
}

/** A ListModels route entry may be a bare id or an object keyed a few ways. */
function parseModelRoute(entry: unknown, sourceProvider?: string): RoutableModel | undefined {
  const v = valueToJs(entry);
  if (typeof v === "string") {
    return asString(v) ? { id: v, provider: sourceProvider } : undefined;
  }
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const id = asString(o.model ?? o.model_id ?? o.modelId ?? o.id ?? o.name);
  if (!id) return undefined;
  const provider = asString(o.provider) ?? sourceProvider;
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === "string")
    : [provider, asString(o.kind)].filter((t): t is string => !!t);
  return {
    id,
    name: asString(o.name),
    description: typeof o.description === "string" ? o.description : null,
    parameters: asString(o.parameters) ?? null,
    available: typeof o.available === "boolean" ? o.available : undefined,
    provider,
    tags,
  };
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

      let activeProvider: string | undefined;

      // Providers + router are the authoritative pair; a failure here is fatal.
      try {
        const { pluginMethods } = await import("@/grpc/plugin-methods");
        const [providersResp, routerResp] = await Promise.all([
          pluginMethods.callSubid<object, { providers?: unknown[] }>(
            "obs.service.tched-router.providers.list@v1",
            {},
          ),
          pluginMethods.callSubid<object, { router?: unknown }>(
            "obs.service.tched-router.router.get@v1",
            {},
          ),
        ]);
        if (cancelled) return;

        const ids = [
          ...new Set(
            (providersResp.providers ?? [])
              .map(parseProviderId)
              .filter((id): id is string => !!id),
          ),
        ];
        const router = (valueToJs(routerResp.router) ?? {}) as Record<string, unknown>;
        activeProvider = asString(router.provider ?? router.selected_provider);
        const activeModel = asString(router.model ?? router.selected_model);

        setStatus({
          provider: activeProvider ?? "",
          model: activeModel ?? "",
          available: typeof router.available === "boolean" ? router.available : undefined,
          available_providers: ids,
        });
        setProviders(ids);
        setCurrentProvider(activeProvider ?? null);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
        return;
      }

      // Models are best-effort, scoped to the requested provider (or the
      // active one) and re-fetched whenever that selection changes.
      try {
        const { pluginMethods } = await import("@/grpc/plugin-methods");
        const sourceProvider = providerFilter ?? activeProvider ?? "";
        const resp = await pluginMethods.callSubid<object, { modelRoutes?: unknown[] }>(
          "obs.service.tched-router.models.list@v1",
          { provider: sourceProvider },
        );
        if (cancelled) return;

        const routes = (resp.modelRoutes ?? [])
          .map((entry) => parseModelRoute(entry, sourceProvider || undefined))
          .filter((m): m is RoutableModel => !!m);
        setModels(routes);
        setModelSource(sourceProvider || "tched_router");
      } catch (e) {
        if (!cancelled) {
          setModels([]);
          setModelSource(null);
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
