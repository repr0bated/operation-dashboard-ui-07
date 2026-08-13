import { PageHeader, Card, StatCard } from "@/components/shell/Primitives";
import { ErrorBanner } from "@/components/shell/Feedback";
import { ZeroclawRoutingPanel } from "@/components/zeroclaw/ZeroclawRoutingPanel";
import { ProviderSelect } from "@/components/shell/ProviderSelect";
import { ModelSelect } from "@/components/shell/ModelSelect";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import { Loader2 } from "lucide-react";

export default function LlmPage() {
  const { snapshot, state, loading, error } = useZeroclawRouting();
  const activeModel = state.selected_model;
  const activeProvider = state.selected_provider;

  return (
    <>
      <PageHeader
        title="LLM"
        subtitle="Zeroclaw provider/model routing, populated from the schemars schema."
        actions={
          <div className="flex items-center gap-2">
            <ProviderSelect />
            <ModelSelect />
          </div>
        }
      />
      {error && <ErrorBanner title="Zeroclaw routing unavailable" message={error} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Active Model" value={activeModel ?? "—"} variant={activeModel ? "ok" : undefined} />
        <StatCard label="Provider" value={activeProvider ?? "—"} variant={activeProvider ? "ok" : undefined} />
        <StatCard
          label="Routable Models"
          value={loading ? "…" : state.model_routes.length}
          sub="via zeroclaw"
        />
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading zeroclaw schema…
        </div>
      )}
      <Card title="Routing schema" subtitle="schemars GetConfigSchema + live GetState.">
        <div className="mt-3">
          <ZeroclawRoutingPanel snapshot={snapshot} />
        </div>
      </Card>
    </>
  );
}
