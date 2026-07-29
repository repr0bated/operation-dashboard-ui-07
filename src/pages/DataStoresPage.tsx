import { useState, useEffect } from "react";
import { Database, Activity, AlertTriangle, CheckCircle, Loader2, HardDrive, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { dataStoreService } from "@/grpc/client";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import type { DataStoreViewStatus as DataStoreStatus } from "@/grpc/view-types";

// NOTE: this page used to fall back to a hardcoded MOCK_STORES array when the
// gRPC call failed, which made a dead backend look like five healthy stores.
// A failure is now reported as a failure.

function formatBytes(bytes: number): string {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

const statusIcon = (s: string) => {
  if (s === "healthy") return <CheckCircle className="h-4 w-4 text-primary" />;
  if (s === "degraded") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <AlertTriangle className="h-4 w-4 text-destructive" />;
};

export default function DataStoresPage() {
  const [stores, setStores] = useState<DataStoreStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dataStoreService.getDataStores()
      .then((r) => { setStores(r.stores); setError(null); })
      .catch((e: unknown) => setError((e as Error)?.message ?? "data store query failed"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-foreground">Data Stores</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Health and status of all persistent and runtime data stores.</p>
      </div>

      {error && <ErrorBanner title="Data store status unavailable" message={error} />}

      {!error && stores.length === 0 && (
        <EmptyState
          title="No data stores reported"
          hint="The control plane returned an empty store list."
        />
      )}

      <div className="grid gap-3">
        {stores.map((store) => (
          <div key={store.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {statusIcon(store.status)}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{store.name}</h3>
                  <p className="text-xs text-muted-foreground">{store.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {store.latencyMs != null && (
                  <span className="flex items-center gap-1">
                    <Wifi className="h-3 w-3" />
                    {store.latencyMs}ms
                  </span>
                )}
                <span className={cn(
                  "font-medium px-1.5 py-0.5 rounded",
                  store.status === "healthy" ? "bg-accent/50 text-accent-foreground" :
                  store.status === "degraded" ? "bg-primary/10 text-primary" :
                  "bg-destructive/10 text-destructive"
                )}>
                  {store.status}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{store.description}</p>
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Database className="h-3 w-3" /> {store.durability}</span>
              {store.sizeBytes != null && store.usedBytes != null && (
                <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {formatBytes(store.usedBytes)} / {formatBytes(store.sizeBytes)}</span>
              )}
              {store.details && Object.entries(store.details).map(([k, v]) => (
                <span key={k} className="bg-muted px-1.5 py-0.5 rounded font-mono">{k}: {String(v)}</span>
              ))}
              <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Checked {new Date(store.lastChecked).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
