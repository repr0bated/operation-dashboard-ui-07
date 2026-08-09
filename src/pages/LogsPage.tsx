import { useState, useMemo, useCallback, useEffect } from "react";
import { PageHeader, Card, Pill } from "@/components/shell/Primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SchemaRenderer } from "@/components/json/SchemaRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEventStore } from "@/stores/event-store";
import { ChevronRight, Wrench, AlertTriangle, RefreshCw, Download, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { LogLevel, JsonSchema } from "@/types/api";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  subsystem: string;
  message: string;
  raw: string;
  metadata?: {
    schema?: JsonSchema;
    payload?: Record<string, unknown>;
    actions?: Array<{ label: string; action: string; variant?: "default" | "outline" | "destructive" }>;
  };
}

export default function LogsPage() {
  const { logs: eventLogs, setLogs } = useEventStore();
  const [filterText, setFilterText] = useState("");
  const [levelFilters, setLevelFilters] = useState<Record<LogLevel, boolean>>(
    Object.fromEntries(LEVELS.map((l) => [l, true])) as Record<LogLevel, boolean>
  );
  const [autoFollow, setAutoFollow] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch logs from procfs blob via REST API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedLogs = await api.logs.list({ limit: 1000 });
        if (!cancelled) {
          setLogs(fetchedLogs);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fetchedLogs = await api.logs.list({ limit: 1000 });
      setLogs(fetchedLogs);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [setLogs]);

  const logEntries = useMemo(() => {
    return eventLogs.map((l, i) => ({
      id: `log-${i}`,
      time: (l as any).timestamp ?? new Date().toISOString(),
      level: ((l as any).level ?? "info") as LogLevel,
      subsystem: (l as any).source ?? (l as any).subsystem ?? "",
      message: (l as any).message ?? String(l),
      raw: JSON.stringify(l),
      metadata: (l as any).metadata,
    })) as LogEntry[];
  }, [eventLogs]);

  const toggleLevel = (level: LogLevel) => {
    setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const needle = filterText.trim().toLowerCase();
  const filtered = logEntries.filter((entry) => {
    if (!levelFilters[entry.level]) return false;
    if (!needle) return true;
    return [entry.message, entry.subsystem, entry.raw].join(" ").toLowerCase().includes(needle);
  });

  const handleExport = useCallback(() => {
    const csv = filtered
      .map((e) => `"${e.time}","${e.level}","${e.subsystem}","${e.message.replace(/"/g, '""')}"`)
      .join("\n");
    const header = '"timestamp","level","subsystem","message"\n';
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const levelColor = (level: LogLevel) => {
    switch (level) {
      case "error": case "fatal": return "text-danger";
      case "warn": return "text-warn";
      case "info": return "text-ok";
      case "debug": return "text-info";
      default: return "text-muted-foreground";
    }
  };

  return (
    <>
      <PageHeader title="Logs" subtitle="Live tail of gateway file logs." actions={
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted/30 transition-colors flex items-center gap-1.5"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
        </div>
      } />
      {error && (
        <div className="mb-4 p-3 rounded-lg border border-danger/30 bg-danger/10 flex gap-2 items-start text-xs text-danger">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Failed to load logs</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="space-y-1.5 min-w-[220px]">
            <span className="text-xs font-medium text-muted-foreground">Filter</span>
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search logs"
              className="w-full px-3 py-2 rounded-md border border-input bg-card text-sm focus:border-ring focus:ring-1 focus:ring-ring outline-none" />
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={autoFollow} onChange={(e) => setAutoFollow(e.target.checked)} className="accent-primary" />
            <span className="text-xs text-muted-foreground">Auto-follow</span>
          </label>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {LEVELS.map((level) => (
            <label key={level} className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium cursor-pointer transition-colors",
              levelFilters[level] ? "border-border bg-muted/30 text-foreground" : "border-transparent text-muted-foreground opacity-50",
            )}>
              <input type="checkbox" checked={levelFilters[level]} onChange={() => toggleLevel(level)} className="hidden" />
              <span className={levelColor(level)}>●</span>
              {level}
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border overflow-hidden max-h-[500px] overflow-y-auto bg-background" style={{ scrollbarWidth: "thin" }}>
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted-foreground/40 animate-pulse" />
              Loading logs…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {logEntries.length === 0 ? "No log entries available." : "No log entries match filters."}
            </div>
          ) : (
            filtered.map((entry) => (
              <LogRow key={entry.id} entry={entry} levelColor={levelColor} />
            ))
          )}
        </div>
      </Card>
    </>
  );
}

function LogRow({ entry, levelColor }: { entry: LogEntry; levelColor: (l: LogLevel) => string }) {
  const hasExpandable = entry.metadata && (entry.metadata.schema || entry.metadata.actions);

  if (!hasExpandable) {
    return (
      <div className="flex items-baseline gap-3 px-3 py-1.5 border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors font-mono text-xs">
        <span className="text-muted-foreground w-20 shrink-0">{new Date(entry.time).toLocaleTimeString()}</span>
        <span className={cn("w-12 shrink-0 font-medium", levelColor(entry.level))}>{entry.level}</span>
        <span className="text-muted-foreground w-16 shrink-0 truncate">{entry.subsystem}</span>
        <span className="text-foreground flex-1 truncate">{entry.message}</span>
      </div>
    );
  }

  return (
    <Collapsible className="border-b border-border/50 last:border-0">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-baseline gap-3 px-3 py-1.5 hover:bg-muted/10 transition-colors font-mono text-xs text-left group">
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform mt-0.5" />
          <span className="text-muted-foreground w-20 shrink-0">{new Date(entry.time).toLocaleTimeString()}</span>
          <span className={cn("w-12 shrink-0 font-medium", levelColor(entry.level))}>{entry.level}</span>
          <span className="text-muted-foreground w-16 shrink-0 truncate">{entry.subsystem}</span>
          <span className="text-foreground flex-1 truncate">{entry.message}</span>
          {entry.metadata?.schema && <Wrench className="h-3 w-3 text-primary/50 shrink-0" />}
          {entry.metadata?.actions && <AlertTriangle className="h-3 w-3 text-warn/50 shrink-0" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 pt-1 ml-6 border-l-2 border-primary/20 space-y-3">
          {entry.metadata?.schema && entry.metadata.payload && (
            <SchemaRenderer schema={entry.metadata.schema} data={entry.metadata.payload} readOnly />
          )}
          {entry.metadata?.actions && (
            <div className="flex items-center gap-2">
              {entry.metadata.actions.map((act) => (
                <Button key={act.action} size="sm"
                  variant={act.variant === "destructive" ? "destructive" : act.variant === "outline" ? "outline" : "default"}
                  className="h-7 text-xs gap-1.5"
                  onClick={(e) => { e.stopPropagation(); console.log("Action:", act.action, entry.metadata?.payload); }}>
                  {act.label}
                </Button>
              ))}
            </div>
          )}
          {!entry.metadata?.schema && entry.metadata?.payload && (
            <pre className="font-mono text-[11px] text-muted-foreground bg-muted/20 rounded-md p-2 whitespace-pre-wrap break-all">
              {JSON.stringify(entry.metadata.payload, null, 2)}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
