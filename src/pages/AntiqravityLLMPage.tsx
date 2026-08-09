import { useCallback, useEffect, useState } from "react";
import type { Spec } from "@json-render/core";
import { RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader, Card } from "@/components/shell/Primitives";
import { EmptyState, ErrorBanner } from "@/components/shell/Feedback";
import { SpecRenderer } from "@/components/ui-model/SpecRenderer";
import { valueToJs } from "@/grpc/google/protobuf/struct";

interface UISurface {
  id: string;
  spec: Spec;
}

export default function AntiqravityLLMPage() {
  const [surfaces, setSurfaces] = useState<UISurface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSurfaces = useCallback(async () => {
    try {
      setError(null);
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      const out = await pluginMethods.callSubid<
        Record<string, never>,
        { ui_surfaces?: unknown[] }
      >("exp.service.antigravity-llm-projection.ui-surfaces@v1", {});

      const raw = out.ui_surfaces ?? [];
      const list: UISurface[] = raw
        .map((s, i) => {
          const spec = valueToJs(s as never) as unknown as Spec | null;
          return spec ? { id: `surface-${i}`, spec } : null;
        })
        .filter((s): s is UISurface => !!s);

      setSurfaces(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSurfaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSurfaces();
  }, [fetchSurfaces]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSurfaces();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Antigravity LLM Projection"
        subtitle="UI surfaces from antigravity-llm-projection service"
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] hover:bg-muted/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {error && (
        <ErrorBanner
          title="Failed to load UI surfaces"
          message={error}
        />
      )}

      {loading ? (
        <Card className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
            <p className="text-sm">Loading UI surfaces…</p>
          </div>
        </Card>
      ) : surfaces.length === 0 ? (
        <EmptyState
          title="No UI surfaces"
          message="The antigravity-llm-projection service returned no UI surfaces."
        />
      ) : (
        <div className="grid gap-4">
          {surfaces.map((surface) => (
            <Card key={surface.id}>
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground font-mono">{surface.id}</div>
                <SpecRenderer spec={surface.spec} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
