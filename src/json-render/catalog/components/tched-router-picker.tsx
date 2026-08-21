import { useState } from "react";
import { useStateValue } from "@json-render/react";
import { uiStore } from "@/json-render/store/ui-store";
import { useLlmRouting } from "@/hooks/use-llm-routing";
import { valueToJs } from "@/grpc/google/protobuf/struct";
import type { El } from "./types";

interface ProviderRow {
  id?: string;
  route?: string;
  kind?: string;
}

interface ModelRoute {
  model?: string;
  provider?: string;
  kind?: string;
  available?: boolean;
}

// callSubid attaches the schema-declared x-opdbus-capability automatically,
// so these stay in lockstep with the sealed tched_router capability names.
async function setSelection(providerId: string, modelId: string): Promise<void> {
  const { pluginMethods } = await import("@/grpc/plugin-methods");
  await pluginMethods.callSubid("mut.service.tched-router.selection.set@v1", {
    providerId,
    modelId,
  });
}

async function listModelIds(providerId: string): Promise<string[]> {
  const { pluginMethods } = await import("@/grpc/plugin-methods");
  const response = await pluginMethods.callSubid<object, { modelRoutes?: unknown[] }>(
    "obs.service.tched-router.models.list@v1",
    { provider: providerId },
  );
  return [
    ...new Set(
      (response.modelRoutes ?? [])
        .map((entry) => {
          const value = valueToJs(entry);
          if (typeof value === "string") return { id: value, available: true };
          if (!value || typeof value !== "object") return undefined;
          const row = value as Record<string, unknown>;
          const id = row.model ?? row.model_id ?? row.modelId ?? row.id ?? row.name;
          return typeof id === "string"
            ? { id, available: row.available !== false }
            : undefined;
        })
        .filter(
          (model): model is { id: string; available: boolean } =>
            !!model && model.id.length > 0 && model.available,
        )
        .map((model) => model.id),
    ),
  ];
}

function patchRouter(patch: Record<string, unknown>): void {
  const current = (uiStore.get("/plugins/tched_router") as Record<string, unknown> | undefined) ?? {};
  uiStore.set("/plugins/tched_router", { ...current, ...patch });
}

export const TchedRouterPickerEl: El<"tchedRouterPicker"> = ({ props }) => {
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const router = (useStateValue("/plugins/tched_router") as Record<string, unknown> | undefined) ?? {};
  const streamProviders = (Array.isArray(router.providers) ? router.providers : []) as ProviderRow[];
  const streamRoutes = (Array.isArray(router.model_routes) ? router.model_routes : []) as ModelRoute[];
  const streamSelectedProvider =
    typeof router.selected_provider === "string" ? router.selected_provider : "";

  // StateSync only carries the sealed schema defaults for tched_router, so on
  // its own this picker offers a frozen catalog. Live routing comes from the
  // tched_router plugin methods (ListProviders / GetRouter / ListModels, via
  // useLlmRouting); treat StateSync as the fallback. The model fetch is scoped
  // to the selected provider so ListModels re-fetches that provider's catalog
  // on every change, instead of filtering one static projection.
  const live = useLlmRouting(streamSelectedProvider || undefined);
  const liveRoutes: ModelRoute[] = live.models.map((m) => ({
    model: m.id,
    // ListModels tags each route with its owning provider; `tags` and the
    // queried source provider are the fallbacks when that field is absent.
    provider: m.provider ?? m.tags?.[0] ?? live.modelSource ?? undefined,
    available: m.available,
  }));

  const routes = [...liveRoutes, ...streamRoutes];
  const selectedProvider =
    streamSelectedProvider ||
    live.currentProvider ||
    live.status?.provider ||
    "";
  const selectedModel =
    (typeof router.selected_model === "string" ? router.selected_model : "") ||
    live.status?.model ||
    "";

  const providerIds = [
    ...new Set([
      ...live.providers,
      ...streamProviders
        .map((p) => p.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ]),
  ];
  if (selectedProvider && !providerIds.includes(selectedProvider)) {
    providerIds.unshift(selectedProvider);
  }

  const models = routes
    .filter(
      (r) =>
        (!selectedProvider || r.provider === selectedProvider) &&
        r.available !== false,
    )
    .map((r) => r.model)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const uniqueModels = [...new Set(models)];
  if (selectedModel && !uniqueModels.includes(selectedModel)) {
    uniqueModels.unshift(selectedModel);
  }

  const onProvider = async (providerId: string) => {
    setSelectionLoading(true);
    setSelectionError(null);
    try {
      // The current hook is intentionally scoped to the active provider. Fetch
      // the target catalog before committing the provider/model pair.
      const nextModels = await listModelIds(providerId);
      const modelId = nextModels.includes(selectedModel) ? selectedModel : nextModels[0];
      if (!modelId) throw new Error(`No selectable models for ${providerId}`);
      await setSelection(providerId, modelId);
      patchRouter({ selected_provider: providerId, selected_model: modelId });
      live.refresh();
    } catch (error) {
      setSelectionError((error as Error).message);
    } finally {
      setSelectionLoading(false);
    }
  };

  const onModel = async (modelId: string) => {
    if (!selectedProvider) return;
    setSelectionLoading(true);
    setSelectionError(null);
    try {
      await setSelection(selectedProvider, modelId);
      patchRouter({ selected_provider: selectedProvider, selected_model: modelId });
      live.refresh();
    } catch (error) {
      setSelectionError((error as Error).message);
    } finally {
      setSelectionLoading(false);
    }
  };

  if (providerIds.length === 0 && uniqueModels.length === 0) {
    // A failed routing fetch must stay visible — it is the useful signal here.
    if (live.error) {
      return (
        <p className="text-xs text-red-400 font-mono">3tched-router routing unavailable: {live.error}</p>
      );
    }
    return (
      <p className="text-xs text-neutral-500 italic">
        {live.loading ? "loading 3tched-router catalog…" : "waiting for tched_router catalog…"}
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${props.className ?? ""}`}>
      <label className="text-[11px] uppercase tracking-wide text-neutral-500">3tched-router</label>
      <select
        value={selectedProvider}
        onChange={(e) => void onProvider(e.target.value)}
        disabled={selectionLoading}
        className="bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 text-xs font-mono"
      >
        {providerIds.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <select
        value={selectedModel}
        onChange={(e) => void onModel(e.target.value)}
        disabled={selectionLoading}
        className="bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 text-xs font-mono min-w-[16rem]"
      >
        {uniqueModels.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      {live.modelsError && (
        <span className="text-[10px] text-red-400 font-mono">{live.modelsError}</span>
      )}
      {selectionError && (
        <span className="text-[10px] text-red-400 font-mono">{selectionError}</span>
      )}
    </div>
  );
};
