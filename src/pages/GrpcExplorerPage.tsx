/**
 * gRPC Explorer
 *
 * Operator-facing console for invoking server-streaming gRPC methods
 * and incrementally rendering the projected JSON frames through the
 * `@json-render/react` catalog.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Card } from "@/components/shell/Primitives";
import { JsonStreamRenderer } from "@/components/json/JsonStreamRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Trash2, Radio, Pause, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  stateSync,
  pluginService,
  eventChainService,
  ovsdbMirror,
  runtimeMirror,
  componentRegistry,
  serviceManager,
  accountabilityService,
  mcpService,
} from "@/grpc/client";

type StreamFactory = () => { stream: ReadableStream<unknown>; abort: () => void };

interface StreamMethod {
  id: string;
  service: string;
  method: string;
  description: string;
  factory: StreamFactory;
}

const STREAMS: StreamMethod[] = [
  {
    id: "state-sync.subscribe",
    service: "StateSync",
    method: "Subscribe",
    description: "Projected state mutations across all plugins.",
    factory: () => stateSync.subscribe({ includeInitialState: true }),
  },
  {
    id: "plugin.signals",
    service: "PluginService",
    method: "SubscribeSignals",
    description: "D-Bus signals fanned out through the gRPC mirror.",
    factory: () => pluginService.subscribeSignals({ pluginId: "", signalNames: [], objectPath: "" }),
  },
  {
    id: "events.subscribe",
    service: "EventChainService",
    method: "SubscribeEvents",
    description: "Audit-trail chain events with cryptographic linkage.",
    factory: () => eventChainService.subscribeEvents({ fromEventId: 0, pluginId: "", tags: [] }),
  },
  {
    id: "runtime.metrics",
    service: "RuntimeMirror",
    method: "StreamMetrics",
    description: "Continuous runtime metrics snapshots.",
    factory: () => runtimeMirror.streamMetrics({}),
  },
  {
    id: "services.watch",
    service: "ServiceManager",
    method: "WatchStatus",
    description: "s6-rc service state transitions.",
    factory: () => serviceManager.watchStatus({}),
  },
  {
    id: "registry.watch",
    service: "ComponentRegistry",
    method: "Watch",
    description: "Plugin component registry updates.",
    factory: () => componentRegistry.watch({}),
  },
  {
    id: "ovsdb.monitor",
    service: "OvsdbMirror",
    method: "Monitor",
    description: "Open vSwitch OVSDB row updates.",
    factory: () => ovsdbMirror.monitor({ database: "Open_vSwitch", monitorRequestsJson: "{}" }),
  },

  {
    id: "accountability.episodes",
    service: "AccountabilityService",
    method: "SubscribeEpisodes",
    description: "Reasoning episodes for AI behaviour audit.",
    factory: () => accountabilityService.subscribeEpisodes({}),
  },
  {
    id: "mcp.events",
    service: "McpService",
    method: "Subscribe",
    description: "MCP tool / resource events.",
    factory: () => mcpService.subscribe({}),
  },
];

type Status = "idle" | "streaming" | "paused" | "closed" | "canceled" | "error";

const DEFAULT_BUFFER = 200;
const MIN_BUFFER = 10;
const MAX_BUFFER_CAP = 5000;
const STORAGE_KEY = "explorer.settings.v1";

interface PersistedSettings {
  methodId: string;
  bufferSize: number;
  filter: string;
}

function loadPersisted(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function parseBuffer(v: string | null | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_BUFFER_CAP, Math.max(MIN_BUFFER, Math.trunc(n)));
}

export default function GrpcExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const persisted = useMemo(loadPersisted, []);

  // Resolution priority: URL → localStorage → default. URL wins so a
  // shared link always reproduces the same view.
  const initialMethodId = (() => {
    const fromUrl = searchParams.get("method");
    const candidate = fromUrl ?? persisted.methodId ?? STREAMS[0].id;
    return STREAMS.some((s) => s.id === candidate) ? candidate : STREAMS[0].id;
  })();
  const initialBuffer = parseBuffer(
    searchParams.get("buffer") ?? persisted.bufferSize?.toString(),
    DEFAULT_BUFFER,
  );
  const initialFilter = searchParams.get("filter") ?? persisted.filter ?? "";

  const [selectedId, setSelectedId] = useState<string>(initialMethodId);
  const [bufferSize, setBufferSize] = useState<number>(initialBuffer);
  const [filter, setFilter] = useState<string>(initialFilter);

  const [messages, setMessages] = useState<unknown[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [frames, setFrames] = useState(0);
  const [bufferedWhilePaused, setBufferedWhilePaused] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const pauseBufferRef = useRef<unknown[]>([]);
  const canceledRef = useRef(false);

  const selected = STREAMS.find((s) => s.id === selectedId)!;

  useEffect(() => () => abortRef.current?.(), []);

  // Persist settings → URL + localStorage on every change.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set("method", selectedId);
    next.set("buffer", String(bufferSize));
    if (filter) next.set("filter", filter);
    else next.delete("filter");
    setSearchParams(next, { replace: true });
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ methodId: selectedId, bufferSize, filter } satisfies PersistedSettings),
      );
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
    // searchParams excluded to avoid feedback loops — we own the keys we set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, bufferSize, filter]);

  const filteredMessages = useMemo(() => {
    if (!filter) return messages;
    const needle = filter.toLowerCase();
    return messages.filter((m) => {
      try {
        return JSON.stringify(m).toLowerCase().includes(needle);
      } catch {
        return false;
      }
    });
  }, [messages, filter]);

  const appendFrame = (value: unknown) => {
    setFrames((f) => f + 1);
    setMessages((prev) =>
      prev.length >= bufferSize ? [...prev.slice(-(bufferSize - 1)), value] : [...prev, value],
    );
  };

  const start = async () => {
    abortRef.current?.();
    pausedRef.current = false;
    canceledRef.current = false;
    pauseBufferRef.current = [];
    setMessages([]);
    setFrames(0);
    setBufferedWhilePaused(0);
    setError(null);
    setStatus("streaming");
    setStartedAt(Date.now());
    try {
      const { stream, abort } = selected.factory();
      abortRef.current = abort;
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (pausedRef.current) {
          // Buffer frames in memory; UI sees them on resume.
          if (pauseBufferRef.current.length >= bufferSize) {
            pauseBufferRef.current.shift();
          }
          pauseBufferRef.current.push(value);
          setBufferedWhilePaused(pauseBufferRef.current.length);
        } else {
          appendFrame(value);
        }
      }
      if (canceledRef.current) setStatus("canceled");
      else setStatus("closed");
    } catch (e) {
      if (canceledRef.current) {
        setStatus("canceled");
      } else {
        setError((e as Error)?.message ?? String(e));
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const pause = () => {
    if (status !== "streaming") return;
    pausedRef.current = true;
    setStatus("paused");
  };

  const resume = () => {
    if (status !== "paused") return;
    pausedRef.current = false;
    // Flush buffered frames into the live view.
    const buffered = pauseBufferRef.current;
    pauseBufferRef.current = [];
    setBufferedWhilePaused(0);
    if (buffered.length) {
      setFrames((f) => f + buffered.length);
      setMessages((prev) => {
        const next = [...prev, ...buffered];
        return next.length > bufferSize ? next.slice(-bufferSize) : next;
      });
    }
    setStatus("streaming");
  };

  const cancel = () => {
    canceledRef.current = true;
    pausedRef.current = false;
    pauseBufferRef.current = [];
    setBufferedWhilePaused(0);
    abortRef.current?.();
    abortRef.current = null;
    setStatus("canceled");
  };

  const clear = () => {
    setMessages([]);
    setFrames(0);
  };

  const isLive = status === "streaming" || status === "paused";


  return (
    <>
      <PageHeader
        title="gRPC Explorer"
        subtitle="Invoke server-streaming methods and render projected frames incrementally."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
        {/* Method list */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Streaming Methods
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {STREAMS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md transition-colors border",
                    selectedId === s.id
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:bg-muted/30",
                  )}
                >
                  <div className="text-xs font-mono font-semibold text-foreground">
                    {s.service}.{s.method}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{s.description}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-semibold text-foreground truncate">
                {selected.service}.{selected.method}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono",
                  status === "streaming" && "border-info/40 text-info",
                  status === "paused" && "border-warn/40 text-warn",
                  status === "closed" && "border-muted-foreground/30 text-muted-foreground",
                  status === "canceled" && "border-muted-foreground/30 text-muted-foreground",
                  status === "error" && "border-danger/40 text-danger",
                )}
              >
                {status}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                {frames} frames
              </Badge>
              {status === "paused" && bufferedWhilePaused > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono border-warn/40 text-warn">
                  +{bufferedWhilePaused} buffered
                </Badge>
              )}
              {startedAt && status !== "idle" && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {((Date.now() - startedAt) / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {!isLive && (
                <Button size="sm" onClick={start} className="h-7 gap-1.5">
                  <Play className="h-3 w-3" /> Invoke
                </Button>
              )}
              {status === "streaming" && (
                <Button size="sm" variant="outline" onClick={pause} className="h-7 gap-1.5">
                  <Pause className="h-3 w-3" /> Pause
                </Button>
              )}
              {status === "paused" && (
                <Button size="sm" onClick={resume} className="h-7 gap-1.5">
                  <Play className="h-3 w-3" /> Resume
                </Button>
              )}
              {isLive && (
                <Button size="sm" variant="outline" onClick={cancel} className="h-7 gap-1.5">
                  <Square className="h-3 w-3" /> Stop
                </Button>
              )}
              {isLive && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancel}
                  className="h-7 gap-1.5 text-danger hover:text-danger"
                  title="Abort the underlying fetch immediately"
                >
                  <X className="h-3 w-3" /> Cancel
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clear} className="h-7 gap-1.5" disabled={!messages.length}>
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>

          </div>

          <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap bg-muted/10">
            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
              <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter frames (substring match on JSON)…"
                className="h-7 text-xs font-mono"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              Page size
              <Input
                type="number"
                min={MIN_BUFFER}
                max={MAX_BUFFER_CAP}
                step={10}
                value={bufferSize}
                onChange={(e) => setBufferSize(parseBuffer(e.target.value, DEFAULT_BUFFER))}
                className="h-7 w-20 text-xs font-mono"
              />
            </label>
            <Badge variant="outline" className="text-[10px] font-mono">
              {filteredMessages.length}/{messages.length} shown
            </Badge>
          </div>

          {error && (
            <div className="px-3 py-2 border-b border-danger/30 bg-danger/5 text-xs font-mono text-danger">
              {error}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-3">
              <JsonStreamRenderer
                messages={filteredMessages}
                title={`${selected.service}.${selected.method}`}
                loading={status === "streaming"}
              />
            </div>
          </ScrollArea>

        </div>
      </div>

      <div className="mt-4">
        <Card title="About this view">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Frames are decoded from the gRPC-Web length-prefixed framing and projected through the shared
              <span className="font-mono text-foreground"> @json-render </span>
              catalog. The last {bufferSize} frames are kept in memory; older frames roll off the buffer.
            </div>
            <div className="text-xs text-muted-foreground">
              Selected method, filter, and page size are persisted in the URL and{" "}
              <span className="font-mono text-foreground">localStorage</span>, so reloading or sharing the
              link reopens the same view.
            </div>
            <div>
              All calls run with the authenticated session — no additional credentials are required inside
              the WireGuard perimeter.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
