import { useState, useEffect, useCallback } from "react";
import { Loader2, Activity, Zap, Clock, BarChart3, RefreshCw, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";
import { embeddingService, blockchainService } from "@/grpc/client";
import type { EmbedRequestInfo, EmbeddingWorkerStatus, ChannelDiagnostics, QdrantCollectionRole } from "@/grpc/view-types";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import { VectorizationModelSelect } from "@/components/zeroclaw/VectorizationModelSelect";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";

function formatBytes(b: number): string {
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(1)} GB`;
}

const statusColors: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  processing: "bg-primary/10 text-primary",
  completed: "bg-accent/50 text-accent-foreground",
  failed: "bg-destructive/10 text-destructive",
  dropped: "bg-destructive/10 text-destructive",
};

const REFRESH_MS = 15000;

export default function EmbeddingPipelinePage() {
  const routing = useZeroclawRouting();
  const vectorization = routing.state.assignments.vectorization;
  const [worker, setWorker] = useState<EmbeddingWorkerStatus | null>(null);
  const [channel, setChannel] = useState<ChannelDiagnostics | null>(null);
  const [queue, setQueue] = useState<EmbedRequestInfo[]>([]);
  const [roles, setRoles] = useState<QdrantCollectionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const [wRes, cRes, qRes, rRes] = await Promise.all([
        embeddingService.getWorkerStatus(),
        embeddingService.getChannelDiagnostics(),
        embeddingService.getQueue({ limit: 20 }),
        blockchainService.getQdrantRoles(),
      ]);
      setWorker(wRes.worker ?? null);
      setChannel(cRes.channel ?? null);
      setQueue(qRes.requests ?? []);
      setRoles(rRes.roles ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const isEmpty = !loading && !error && !worker && !channel && queue.length === 0 && roles.length === 0;
  const stage = vectorization ?? "vectorization";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-foreground">Embedding Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Footprint → mpsc channel → Embedding Worker → {stage} → Qdrant
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Orbit className="h-4 w-4 text-primary" /> Zeroclaw vectorization
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Routing authority for this pipeline. The embedding worker's reported model may lag.
            </p>
          </div>
          {vectorization && (
            <span className="text-xs font-mono font-medium text-foreground shrink-0">{vectorization}</span>
          )}
        </div>
        <VectorizationModelSelect />
        {worker && (
          <p className="text-[10px] text-muted-foreground">
            Runtime worker: <span className="font-mono">{worker.provider}</span>
            {" / "}
            <span className="font-mono">{worker.model}</span>
          </p>
        )}
      </div>

      {error && <ErrorBanner title="Embedding service unavailable" message={error} />}
      {isEmpty && (
        <EmptyState
          title="No pipeline activity"
          hint="The embedding worker is reachable but hasn't reported any state, queue, or Qdrant roles yet."
        />
      )}

      {loading && !worker && !channel && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}


      {/* Worker + Channel side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Worker Status */}
        {worker && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Embedding Worker
              </h2>
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                worker.active ? "bg-accent/50 text-accent-foreground" : "bg-destructive/10 text-destructive"
              )}>
                {worker.active ? "Active" : "Stopped"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Provider:</span> <span className="font-mono">{worker.provider}</span></div>
              <div><span className="text-muted-foreground">Model:</span> <span className="font-mono">{worker.model}</span></div>
              <div><span className="text-muted-foreground">Dimensions:</span> {worker.vectorDimension}</div>
              <div><span className="text-muted-foreground">Uptime:</span> {worker.stats.uptime}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-muted/30 rounded">
                <p className="text-lg font-bold text-foreground">{worker.stats.embedsCompleted.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <p className="text-lg font-bold text-foreground">{worker.stats.embedsFailed}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded">
                <p className="text-lg font-bold text-foreground">{worker.stats.avgLatencyMs}ms</p>
                <p className="text-[10px] text-muted-foreground">Avg Latency</p>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Retry: {worker.retryConfig.maxAttempts} attempts, {worker.retryConfig.baseDelayMs}ms base, exponential backoff
            </div>
          </div>
        )}

        {/* Channel Diagnostics */}
        {channel && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> mpsc Channel
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Usage</span>
                <span>{channel.currentUsage} / {channel.capacity}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(channel.currentUsage / channel.capacity) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Dropped:</span> <span className={channel.totalDropped > 0 ? "text-destructive font-bold" : ""}>{channel.totalDropped}</span></div>
              <div><span className="text-muted-foreground">Drop rate:</span> {channel.dropRate}/min</div>
            </div>
            <div className="bg-muted/30 rounded p-2 space-y-1">
              <p className="text-[10px] text-muted-foreground"><strong>Policy:</strong> {channel.dropPolicy}</p>
              <p className="text-[10px] text-muted-foreground"><strong>Rationale:</strong> {channel.rationale}</p>
              <p className="text-[10px] text-muted-foreground"><strong>Audit truth:</strong> {channel.auditSourceOfTruth}</p>
            </div>
          </div>
        )}
      </div>

      {/* Queue */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Embed Queue
        </h2>
        <div className="space-y-2">
          {queue.length === 0 && <p className="text-sm text-muted-foreground">Queue empty — all requests processed.</p>}
          {queue.map((req) => (
            <div key={req.blockHash} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-medium text-foreground">{req.blockHash}</span>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", statusColors[req.status] ?? "bg-muted text-muted-foreground")}>
                  {req.status}{req.attempt > 0 ? ` (attempt ${req.attempt})` : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono break-all mb-1">{req.embeddingText}</p>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>Collection: {req.collection}</span>
                <span>Queued: {new Date(req.queuedAt).toLocaleTimeString()}</span>
                {req.error && <span className="text-destructive">{req.error}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Qdrant Roles */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Qdrant Collection Roles
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {roles.map((r) => (
            <div key={r.name} className="rounded-lg border border-border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-medium text-foreground">{r.name}</span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{r.role.replace("_", " ")}</span>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{r.pointCount.toLocaleString()} points</span>
                <span>{formatBytes(r.diskSizeBytes)}</span>
                <span>Updated {new Date(r.lastUpdated).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
