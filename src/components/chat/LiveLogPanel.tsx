/**
 * Live log panel — subscribes to gRPC streams, normalizes every frame
 * through the AntigravityStreamAdapter, and renders the resulting
 * Antigravity SSE events (interaction.created / step.* / error /
 * interaction.completed) as a rolling console log.
 *
 * Today: EventChainService.SubscribeEvents → chain_event frames.
 * Tomorrow: drop any other stream into the same adapter and the
 * renderer stays unchanged.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { eventChainService } from "@/grpc/client";
import type { ChainEvent } from "@/grpc/gen/operation";
import {
  AntigravityStreamAdapter,
  type AgEvent,
  type AgStep,
} from "@/lib/antigravity-adapter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square, Trash2, Radio, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  ts: number;
  event: AgEvent;
}

const MAX_LINES = 500;
const TYPE_COLORS: Record<string, string> = {
  model_output: "text-foreground",
  thought: "text-violet-400",
  function_call: "text-info",
  function_result: "text-emerald-400",
  google_search_call: "text-info",
  google_search_result: "text-emerald-400",
  code_execution_call: "text-info",
  code_execution_result: "text-emerald-400",
  system_message: "text-muted-foreground",
  compaction: "text-amber-400",
  finish: "text-primary",
  error: "text-danger",
};

function eventLabel(e: AgEvent): string {
  switch (e.event_type) {
    case "step.start":
    case "step.delta":
    case "step.stop":
      return e.event_type;
    default:
      return e.event_type;
  }
}

function eventStep(e: AgEvent): AgStep | null {
  return e.event_type === "step.start" ? e.step : null;
}

function eventText(e: AgEvent): string {
  switch (e.event_type) {
    case "interaction.created":
      return `interaction ${e.interaction.id} (${e.interaction.model})`;
    case "interaction.status_update":
      return `${e.interaction_id} → ${e.status}`;
    case "interaction.completed":
      return `interaction ${e.interaction.id} completed`;
    case "step.start":
      return e.step.content || e.step.name || e.step.id;
    case "step.delta":
      if (e.delta.type === "text" || e.delta.type === "thought_summary") return e.delta.text;
      return `Δ ${e.delta.type}`;
    case "step.stop":
      return `step ${e.index} ✓`;
    case "error":
      return `${e.error.code}: ${e.error.message}`;
  }
}

export function LiveLogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "paused" | "closed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [autoscroll, setAutoscroll] = useState(true);
  const [filter, setFilter] = useState("");
  const abortRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const seqRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<AntigravityStreamAdapter | null>(null);

  const appendEvents = (events: AgEvent[]) => {
    if (!events.length) return;
    setEntries((prev) => {
      const wrapped: LogEntry[] = events.map((event) => {
        seqRef.current += 1;
        return { id: `${Date.now()}-${seqRef.current}`, ts: Date.now(), event };
      });
      const next = [...prev, ...wrapped];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  };

  const start = async () => {
    abortRef.current?.();
    pausedRef.current = false;
    setError(null);
    setStatus("streaming");

    const adapter = new AntigravityStreamAdapter();
    adapterRef.current = adapter;
    appendEvents([adapter.open("op-grpc/event-chain")]);

    try {
      const { stream, abort } = eventChainService.subscribeEvents({
        fromEventId: "0",
        pluginId: "",
        tags: [],
      });
      abortRef.current = abort;
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (pausedRef.current) continue;
        appendEvents(adapter.ingest({ kind: "chain_event", data: value as ChainEvent }));
      }
      appendEvents(adapter.close());
      setStatus("closed");
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      setError(message);
      appendEvents([adapter.error(message)]);
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.();
    abortRef.current = null;
    if (adapterRef.current) appendEvents(adapterRef.current.close());
    setStatus("closed");
  };

  const togglePause = () => {
    if (status === "streaming") {
      pausedRef.current = true;
      setStatus("paused");
    } else if (status === "paused") {
      pausedRef.current = false;
      setStatus("streaming");
    }
  };

  const exportLog = () => {
    if (!entries.length) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      status,
      count: entries.length,
      entries: entries.map((e) => ({
        id: e.id,
        ts: e.ts,
        iso: new Date(e.ts).toISOString(),
        event: e.event,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `antigravity-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Auto-start on mount, abort on unmount.
  useEffect(() => {
    void start();
    return () => abortRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new entries.
  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, autoscroll]);

  const visible = useMemo(() => {
    if (!filter) return entries;
    const needle = filter.toLowerCase();
    return entries.filter((entry) => {
      const step = eventStep(entry.event);
      const haystack = [
        eventLabel(entry.event),
        eventText(entry.event),
        step?.type,
        step?.name,
        step?.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap shrink-0 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <Radio
            className={cn(
              "h-3.5 w-3.5",
              status === "streaming" && "text-info animate-pulse",
              status === "paused" && "text-warn",
              status === "error" && "text-danger",
              (status === "idle" || status === "closed") && "text-muted-foreground",
            )}
          />
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-mono",
              status === "streaming" && "border-info/40 text-info",
              status === "paused" && "border-warn/40 text-warn",
              status === "error" && "border-danger/40 text-danger",
            )}
          >
            Antigravity · EventChainService.SubscribeEvents · {status}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            {visible.length}/{entries.length}
          </Badge>
        </div>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter step.type, name, content…"
          className="ml-auto h-7 w-56 px-2 rounded-md border border-input bg-card text-xs font-mono outline-none focus:border-ring"
        />

        <label className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
          <input
            type="checkbox"
            checked={autoscroll}
            onChange={(e) => setAutoscroll(e.target.checked)}
            className="h-3 w-3"
          />
          Follow
        </label>

        <div className="flex items-center gap-1.5">
          {status === "streaming" || status === "paused" ? (
            <Button size="sm" variant="outline" onClick={togglePause} className="h-7 gap-1.5">
              {status === "paused" ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {status === "paused" ? "Resume" : "Pause"}
            </Button>
          ) : (
            <Button size="sm" onClick={() => void start()} className="h-7 gap-1.5">
              <Play className="h-3 w-3" /> Start
            </Button>
          )}
          {(status === "streaming" || status === "paused") && (
            <Button size="sm" variant="outline" onClick={stop} className="h-7 gap-1.5">
              <Square className="h-3 w-3" /> Stop
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEntries([])}
            disabled={!entries.length}
            className="h-7 gap-1.5"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={exportLog}
            disabled={!entries.length}
            className="h-7 gap-1.5"
          >
            <Download className="h-3 w-3" /> Export JSON
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 border-b border-danger/30 bg-danger/5 text-xs font-mono text-danger shrink-0">
          {error}
        </div>
      )}

      {/* Log body */}
      <div className="flex-1 overflow-auto bg-background font-mono text-[11px] leading-relaxed">
        {visible.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {status === "streaming" ? "Awaiting first event…" : "No log entries."}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {visible.map((entry) => {
              const step = eventStep(entry.event);
              const typeKey = step?.type ?? (entry.event.event_type === "error" ? "error" : "");
              return (
                <div
                  key={entry.id}
                  className="px-4 py-1 hover:bg-muted/20 flex items-baseline gap-2 min-w-0"
                >
                  <span className="text-muted-foreground shrink-0">
                    {new Date(entry.ts).toLocaleTimeString(undefined, { hour12: false })}
                  </span>
                  <span className="text-muted-foreground/70 shrink-0 w-24 truncate">
                    {eventLabel(entry.event)}
                  </span>
                  {step && (
                    <span className={cn("shrink-0 truncate max-w-[140px]", TYPE_COLORS[step.type] ?? "text-info")}>
                      {step.type}
                    </span>
                  )}
                  {step?.name && (
                    <span className="text-primary shrink-0 truncate max-w-[180px]">{step.name}</span>
                  )}
                  <span
                    className={cn(
                      "break-all min-w-0",
                      typeKey && TYPE_COLORS[typeKey] ? TYPE_COLORS[typeKey] : "text-foreground",
                    )}
                  >
                    {eventText(entry.event)}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
