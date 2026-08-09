import { useCallback, useEffect, useState } from "react";
import type { Spec } from "@json-render/core";
import { RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader, Card } from "@/components/shell/Primitives";
import { EmptyState, ErrorBanner } from "@/components/shell/Feedback";
import { SpecRenderer } from "@/components/ui-model/SpecRenderer";
import { fetchAntigravityGalleryBundle } from "@/lib/plugin-ui-surfaces";

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
      const bundle = await fetchAntigravityGalleryBundle();
      const list: UISurface[] = bundle.surfaces.map((surface) => ({
        id: surface.id,
        spec: surface.spec,
      }));

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
        subtitle="UI routes from Antigravity's sealed plugin projection"
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
          message="The sealed Antigravity projection declares no UI surfaces."
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
