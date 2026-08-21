import { useStateValue } from "@json-render/react";
import { uiStore } from "@/json-render/store/ui-store";
import { useLlmRouting } from "@/hooks/use-llm-routing";
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
async function setProvider(providerId: string): Promise<void> {
  const { pluginMethods } = await import("@/grpc/plugin-methods");
  await pluginMethods.callSubid("mut.service.tched-router.provider.set@v1", { providerId });
}

async function setModel(modelId: string): Promise<void> {
  const { pluginMethods } = await import("@/grpc/plugin-methods");
  await pluginMethods.callSubid("mut.service.tched-router.model.set@v1", { modelId });
}

function patchRouter(patch: Record<string, unknown>): void {
  const current = (uiStore.get("/plugins/tched_router") as Record<string, unknown> | undefined) ?? {};
  uiStore.set("/plugins/tched_router", { ...current, ...patch });
}

export const TchedRouterPickerEl: El<"tchedRouterPicker"> = ({ props }) => {
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
    .filter((r) => !selectedProvider || r.provider === selectedProvider)
    .map((r) => r.model)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const uniqueModels = [...new Set(models)];
  if (selectedModel && !uniqueModels.includes(selectedModel)) {
    uniqueModels.unshift(selectedModel);
  }

  const onProvider = async (providerId: string) => {
    patchRouter({ selected_provider: providerId });
    await setProvider(providerId);
    const nextModels = routes
      .filter((r) => r.provider === providerId)
      .map((r) => r.model)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (nextModels[0] && !nextModels.includes(selectedModel)) {
      patchRouter({ selected_model: nextModels[0] });
      await setModel(nextModels[0]);
    }
  };

  const onModel = async (modelId: string) => {
    patchRouter({ selected_model: modelId });
    await setModel(modelId);
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
        className="bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 text-xs font-mono"
      >
        {providerIds.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <select
        value={selectedModel}
        onChange={(e) => void onModel(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 text-white rounded px-2 py-1 text-xs font-mono min-w-[16rem]"
      >
        {uniqueModels.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      {live.modelsError && (
        <span className="text-[10px] text-red-400 font-mono">{live.modelsError}</span>
      )}
    </div>
  );
};
