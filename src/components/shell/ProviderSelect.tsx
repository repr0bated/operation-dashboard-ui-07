/**
 * Model/provider picker — backed by 3tched-router's real provider catalog
 * (schema-driven; new providers registered there show up here automatically,
 * no hardcoded list). Providers populated via `ListProviders` + `GetRouter`
 * (obs.service.tched-router.providers.list@v1 / obs.service.tched-router.router.get@v1);
 * the model list is fetched from whichever provider is selected via
 * `ListModels` (obs.service.tched-router.models.list@v1) and re-fetched on
 * every provider change. Provider and model are applied together through
 * `SetSelection` (mut.service.tched-router.selection.set@v1).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { valueToJs } from "@/grpc/google/protobuf/struct";
import { Boxes, Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TchedRouterProvider {
  id?: string;
  kind?: string;
  description?: string;
}

const FALLBACK_PROVIDER = "salad";

/** A ListModels route entry may be a bare id or an object keyed a few ways. */
function routeModelId(route: unknown): string | undefined {
  const v = valueToJs(route);
  if (typeof v === "string") return v.length > 0 ? v : undefined;
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const id = o.model ?? o.model_id ?? o.modelId ?? o.id ?? o.name;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

interface Props {
  className?: string;
}

export function ProviderSelect({ className }: Props) {
  const [providers, setProviders] = useState<TchedRouterProvider[]>([]);
  const [value, setValue] = useState<string>(FALLBACK_PROVIDER);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyingModel, setApplyingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drops stale ListModels responses when the provider changes mid-flight.
  const modelsSeq = useRef(0);

  const loadModels = useCallback(async (providerId: string, preferred?: string): Promise<string[]> => {
    const seq = ++modelsSeq.current;
    setModelsLoading(true);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      const resp = await pluginMethods.callSubid<object, { modelRoutes?: unknown[] }>(
        "obs.service.tched-router.models.list@v1",
        { provider: providerId },
      );
      if (seq !== modelsSeq.current) return [];
      const ids = [
        ...new Set(
          (resp.modelRoutes ?? [])
            .map(routeModelId)
            .filter((id): id is string => !!id),
        ),
      ];
      setModels(ids);
      // Keep the active model only while the selected provider still routes it.
      setModel((current) => {
        const wanted = preferred || current;
        return wanted && ids.includes(wanted) ? wanted : "";
      });
      return ids;
    } catch (e) {
      if (seq === modelsSeq.current) setError((e as Error).message);
      return [];
    } finally {
      if (seq === modelsSeq.current) setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
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
        if (!alive) return;
        const list = (providersResp.providers ?? [])
          .map((p) => {
            const o = (valueToJs(p) ?? {}) as Record<string, unknown>;
            const id = o.id ?? o.provider_id ?? o.providerId ?? o.name;
            return {
              id: typeof id === "string" ? id : undefined,
              kind: typeof o.kind === "string" ? o.kind : undefined,
              description:
                typeof o.description === "string" ? o.description : undefined,
            } as TchedRouterProvider;
          })
          .filter((p): p is TchedRouterProvider & { id: string } => !!p.id);
        setProviders(list);
        const router = valueToJs(routerResp.router) as
          | { provider?: string; selected_provider?: string; model?: string; selected_model?: string }
          | undefined;
        const activeProvider = router?.provider ?? router?.selected_provider;
        const initial =
          activeProvider && list.some((p) => p.id === activeProvider)
            ? activeProvider
            : list.some((p) => p.id === FALLBACK_PROVIDER)
              ? FALLBACK_PROVIDER
              : (list[0]?.id ?? FALLBACK_PROVIDER);
        setValue(initial);
        setError(null);
        const activeModel =
          typeof router?.model === "string" && router.model.length > 0
            ? router.model
            : typeof router?.selected_model === "string"
              ? router.selected_model
              : undefined;
        void loadModels(initial, activeModel);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadModels]);

  const apply = async (providerId: string) => {
    const prevProvider = value;
    const prevModel = model;
    setValue(providerId);
    setApplying(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      const ids = await loadModels(providerId);
      const modelId = ids.includes(prevModel) ? prevModel : ids[0];
      if (!modelId) throw new Error(`No selectable models for ${providerId}`);
      await pluginMethods.callSubid("mut.service.tched-router.selection.set@v1", {
        providerId,
        modelId,
      });
      setModel(modelId);
    } catch (e) {
      setValue(prevProvider);
      setModel(prevModel);
      void loadModels(prevProvider, prevModel);
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const applyModel = async (modelId: string) => {
    const prev = model;
    setModel(modelId);
    setApplyingModel(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      await pluginMethods.callSubid("mut.service.tched-router.selection.set@v1", {
        providerId: value,
        modelId,
      });
    } catch (e) {
      setModel(prev);
      setError((e as Error).message);
    } finally {
      setApplyingModel(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select value={value} onValueChange={(v) => void apply(v)} disabled={loading}>
        <SelectTrigger className="h-8 w-[200px] text-xs font-mono">
          {loading || applying ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Cpu className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue placeholder="Provider…" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.id} value={p.id as string} className="text-xs font-mono">
              {p.id}
              {p.kind ? ` · ${p.kind}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={model}
        onValueChange={(v) => void applyModel(v)}
        disabled={loading || modelsLoading || models.length === 0}
      >
        <SelectTrigger className="h-8 w-[220px] text-xs font-mono">
          {modelsLoading || applyingModel ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Boxes className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue
            placeholder={
              loading || modelsLoading
                ? "Models…"
                : models.length === 0
                  ? "No models"
                  : "Model…"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m} className="text-xs font-mono">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-[10px] text-danger font-mono">{error}</span>}
    </div>
  );
}
