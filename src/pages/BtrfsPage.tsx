import { useState, useEffect, useCallback } from "react";
import { HardDrive, Database, Activity, Shield, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { btrfsService } from "@/grpc/client";
import type { BtrfsSubvolumeView as BtrfsSubvolume, BtrfsSnapshotView as BtrfsSnapshot, DrRecoveryStatusView as DrRecoveryStatus, SendState } from "@/grpc/view-types";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function UsageBar({ used, total, className }: { used: number; total: number; className?: string }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className={cn("h-2 bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all", pct > 80 ? "bg-destructive" : pct > 60 ? "bg-warning" : "bg-primary")}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

const REFRESH_MS = 20000;

export default function BtrfsPage() {
  const [subvolumes, setSubvolumes] = useState<BtrfsSubvolume[]>([]);
  const [snapshots, setSnapshots] = useState<BtrfsSnapshot[]>([]);
  const [sendState, setSendState] = useState<SendState[]>([]);
  const [drStatus, setDrStatus] = useState<DrRecoveryStatus | null>(null);
  const [raidInfo, setRaidInfo] = useState({ raidLevel: "", devices: [] as string[], totalBytes: 0, usedBytes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSnap, setExpandedSnap] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const [subRes, snapRes, sendRes, drRes] = await Promise.all([
        btrfsService.getSubvolumes(),
        btrfsService.getSnapshots({}),
        btrfsService.getSendState(),
        btrfsService.getDrStatus(),
      ]);
      setSubvolumes(subRes.subvolumes ?? []);
      setRaidInfo({ raidLevel: subRes.raidLevel ?? "", devices: subRes.devices ?? [], totalBytes: subRes.totalBytes ?? 0, usedBytes: subRes.usedBytes ?? 0 });
      setSnapshots(snapRes.snapshots ?? []);
      setSendState(sendRes.remotes ?? []);
      setDrStatus(drRes.status ?? null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEmpty = subvolumes.length === 0 && snapshots.length === 0 && sendState.length === 0 && !drStatus;

  if (error || isEmpty) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-foreground">BTRFS Storage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Subvolume layout, snapshots, incremental send state, and disaster recovery status.
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
        {error ? (
          <ErrorBanner title="BTRFS service unavailable" message={error} />
        ) : (
          <EmptyState title="No BTRFS state reported" hint="The BTRFS service is reachable but hasn't returned any subvolumes, snapshots, or DR status yet." icon={HardDrive} />
        )}
      </div>
    );
  }


  const purposeLabels: Record<string, string> = {
    audit_ledger: "Audit Ledger (Blockchain)",
    dr_state: "DR State (current.json)",
    vector_storage: "Vector Storage (Qdrant)",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-foreground">BTRFS Storage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Subvolume layout, snapshots, incremental send state, and disaster recovery status.
        </p>
      </div>

      {/* RAID overview */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{raidInfo.raidLevel}</span>
            <span className="text-xs text-muted-foreground">({raidInfo.devices.join(" + ")})</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatBytes(raidInfo.usedBytes)} / {formatBytes(raidInfo.totalBytes)}
          </span>
        </div>
        <UsageBar used={raidInfo.usedBytes} total={raidInfo.totalBytes} />
      </div>

      {/* Subvolumes */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          Subvolumes
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {subvolumes.map((sv) => (
            <div key={sv.name} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-medium text-foreground">{sv.path}</span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{sv.snapshotCount} snaps</span>
              </div>
              <p className="text-xs text-muted-foreground">{purposeLabels[sv.purpose] ?? sv.purpose}</p>
              <UsageBar used={sv.usedBytes} total={sv.sizeBytes} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatBytes(sv.usedBytes)} / {formatBytes(sv.sizeBytes)}</span>
                <span>Modified {new Date(sv.lastModified).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Snapshots */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Snapshots
          <span className="text-xs text-muted-foreground font-normal">({snapshots.length})</span>
        </h2>
        <div className="space-y-2">
          {snapshots.map((snap) => (
            <div key={snap.id} className="rounded-lg border border-border bg-card">
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedSnap(expandedSnap === snap.id ? null : snap.id)}
              >
                <span className="text-xs font-mono font-medium text-foreground">{snap.id}</span>
                <span className="text-[10px] text-muted-foreground">{snap.subvolume}</span>
                <span className="text-[10px] text-muted-foreground">{formatBytes(snap.sizeBytes)}</span>
                {snap.pinned && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                    📌 Pinned ({snap.pinnedRemotes.length} remote{snap.pinnedRemotes.length !== 1 ? "s" : ""})
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{new Date(snap.createdAt).toLocaleString()}</span>
                {expandedSnap === snap.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              {expandedSnap === snap.id && (
                <div className="px-3 pb-3 border-t border-border/50 pt-2 text-xs text-muted-foreground space-y-1">
                  {snap.parentSnapshotId && <p>Parent: <span className="font-mono">{snap.parentSnapshotId}</span></p>}
                  {snap.pinnedRemotes.length > 0 && <p>Pinned for: {snap.pinnedRemotes.join(", ")}</p>}
                  <p className="text-[10px] italic">Pin released only after successful incremental send to ALL remotes</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Send State */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Incremental Send State
        </h2>
        <div className="space-y-2">
          {sendState.map((s) => (
            <div key={s.remoteName} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.remoteName}</span>
                  <span className="text-xs text-muted-foreground font-mono">{s.remoteHost}:{s.remotePath}</span>
                </div>
                <span className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded",
                  s.status === "idle" ? "bg-accent/50 text-accent-foreground" :
                  s.status === "sending" ? "bg-primary/10 text-primary" :
                  "bg-destructive/10 text-destructive"
                )}>
                  {s.status}
                </span>
              </div>
              <div className="flex gap-4 text-[10px] text-muted-foreground">
                <span>Last sent: <span className="font-mono">{s.lastSentSnapshotId || "never"}</span></span>
                <span>At: {new Date(s.lastSentAt).toLocaleString()}</span>
                {s.bytesTransferred > 0 && <span>Transferred: {formatBytes(s.bytesTransferred)}</span>}
              </div>
              {s.lastError && (
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {s.lastError}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DR Status */}
      {drStatus && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Disaster Recovery Status
          </h2>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="flex items-center gap-2">
                {drStatus.stateSubvolCurrent ? <CheckCircle className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                <div>
                  <p className="text-xs font-medium">state_subvol/current.json</p>
                  <p className="text-[10px] text-muted-foreground">{drStatus.stateSubvolCurrent ? "Valid" : "Missing/Invalid"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {drStatus.vectorSnapshotAvailable ? <CheckCircle className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                <div>
                  <p className="text-xs font-medium">Vector Snapshot</p>
                  <p className="text-[10px] text-muted-foreground">{drStatus.vectorSnapshotAvailable ? "Available" : "Missing"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium">Blocks to Replay</p>
                <p className="text-[10px] text-muted-foreground">{drStatus.blocksToReplay}</p>
              </div>
              <div>
                <p className="text-xs font-medium">Last Checkpoint</p>
                <p className="text-[10px] text-muted-foreground">{new Date(drStatus.lastCheckpoint).toLocaleString()}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">Recovery Order</p>
              <ol className="space-y-1">
                {drStatus.recoverySteps.map((step, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
