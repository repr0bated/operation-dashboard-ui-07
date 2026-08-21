/**
 * Routable Models — live LLM gateway routing.
 *
 * Every value here comes from tched_router plugin methods over the gRPC bridge:
 *   obs.service.tched-router.router.get@v1      active provider + model
 *   obs.service.tched-router.providers.list@v1  registered providers
 *   obs.service.tched-router.models.list@v1     routable models per provider
 *
 * This page previously rendered a hardcoded MOCK_AGENTS array (gpt-4o,
 * gpt-4o-mini) that had no relationship to the running gateway. There is no
 * mock fallback now: when the backend cannot answer, the error is shown.
 */
import { useState } from "react";
import { PageHeader, Card, Pill, StatCard, StatusDot } from "@/components/shell/Primitives";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLlmRouting } from "@/hooks/use-llm-routing";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RoutableModelsPage() {
  // undefined = let the backend pick its default source (the tched_router projection)
  const [providerFilter, setProviderFilter] = useState<string | undefined>(undefined);
  const {
    status,
    providers,
    currentProvider,
    models,
    modelSource,
    loading,
    error,
    modelsError,
    refresh,
  } = useLlmRouting(providerFilter);

  return (
    <>
      <PageHeader
        title="Routable Models"
        subtitle="LLM gateway model routing, read live from the control plane."
        actions={
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-border bg-[hsl(var(--bg-elevated))] text-sm font-medium hover:bg-muted/30 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
        }
      />

      {error && <ErrorBanner title="LLM gateway unavailable" message={error} />}

      {/* Active routing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active Provider"
          value={status?.provider ?? currentProvider ?? "—"}
          variant={status?.provider ? "ok" : "danger"}
        />
        <StatCard label="Active Model" value={status?.model || "—"} />
        <StatCard
          label="Providers"
          value={providers.length || "—"}
          sub="registered"
        />
        <StatCard
          label="Routable Models"
          value={modelsError ? "—" : models.length}
          sub={modelSource ? `via ${modelSource}` : undefined}
          variant={modelsError ? "warn" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Providers */}
        <Card
          title="Providers"
          subtitle="Registered in the gateway. Select one to list its models."
        >
          <div className="space-y-1 mt-2">
            <button
              onClick={() => setProviderFilter(undefined)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-colors",
                providerFilter === undefined
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent hover:bg-muted/30",
              )}
            >
              <div className="text-sm font-medium text-foreground">Default projection</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                tched_router model routes
              </div>
            </button>

            {loading && providers.length === 0 && (
              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading providers…
              </div>
            )}

            {providers.map((p) => {
              const isCurrent = p === (status?.provider ?? currentProvider);
              return (
                <button
                  key={p}
                  onClick={() => setProviderFilter(p)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors",
                    providerFilter === p
                      ? "border-primary/30 bg-primary/5"
                      : "border-transparent hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={isCurrent ? "ok" : "offline"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate font-mono">
                        {p}
                      </div>
                    </div>
                    {isCurrent && <Pill variant="ok">active</Pill>}
                  </div>
                </button>
              );
            })}

            {!loading && providers.length === 0 && !error && (
              <div className="p-3 text-xs text-muted-foreground font-mono">
                No providers registered.
              </div>
            )}
          </div>
        </Card>

        {/* Models */}
        <Card
          title={providerFilter ? `Models · ${providerFilter}` : "Models · default projection"}
          subtitle={
            modelSource
              ? `Source: ${modelSource}`
              : "Model list served by tched_router."
          }
        >
          {modelsError && (
            <ErrorBanner
              title="Model list unavailable"
              message={modelsError}
              className="mt-2"
            />
          )}

          {loading && models.length === 0 && !modelsError && (
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading models…
            </div>
          )}

          {!loading && models.length === 0 && !modelsError && (
            <EmptyState
              title="No routable models"
              hint="The gateway returned an empty model list for this source."
              className="mt-3"
            />
          )}

          {models.length > 0 && (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Model ID</TableHead>
                  <TableHead className="text-[11px]">Name</TableHead>
                  <TableHead className="text-[11px]">Params</TableHead>
                  <TableHead className="text-[11px]">Tags</TableHead>
                  <TableHead className="text-[11px] text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                    <TableCell className="text-xs">{m.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.parameters ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m.tags ?? []).slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] font-mono">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusDot status={m.available === false ? "offline" : "ok"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
