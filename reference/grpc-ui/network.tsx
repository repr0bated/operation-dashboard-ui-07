/**
 * Network Control Surface catalog widgets.
 *
 * Self-fetching interactive kinds for the `/network` page spec.
 * Transport is tonic-web (gRPC-Web) on :8090 — same path as Invoke / Explorer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Search,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Radio,
  Play,
  Trash2,
  Zap,
  Pause,
  Square,
  Shield,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JsonRenderer } from "@/components/json/JsonRenderer";
import { JsonStreamRenderer } from "@/components/json/JsonStreamRenderer";
import { SchemaRenderer } from "@/components/json/SchemaRenderer";
import { ReflectionFallbackBanner } from "@/components/shell/ReflectionFallbackBanner";
import { StatusDot } from "@/components/shell/Primitives";
import { callUnary, hasCodec, getStaticServiceCatalog } from "@/grpc/client";
import {
  stateSync,
  pluginService,
  eventChainService,
  componentRegistry,
  accountabilityService,
  mcpService,
} from "@/grpc/client";
import {
  useReflectionRegistry,
  type ReflectedMethod,
  type ReflectedService,
} from "@/hooks/use-reflection-registry";
import { useStateStore, useStateValue } from "@json-render/react";
import { useEventStore } from "@/stores/event-store";
import { cn } from "@/lib/utils";
import {
  isDeprecatedReflectionService,
} from "@/lib/deprecated-reflection-services";
import type { JsonSchema } from "@/types/api";
import type { El } from "./types";

/** json-render state paths for Network Control (shared via StateProvider). */
const NC = {
  selection: "/network/selection",
  payload: "/network/payload",
} as const;

function methodKey(service: string, method: string): string {
  return `${service}/${method}`;
}

interface NetworkSelection {
  serviceName: string;
  methodName: string;
  key: string;
  inputType: string;
  outputType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
}

// ── stream factories (tonic-web server streams, same as Explorer) ────────

type StreamFactory = () => { stream: ReadableStream<unknown>; abort: () => void };

interface KnownStream {
  id: string;
  /** Fully-qualified or short service name fragments to match reflection. */
  serviceMatch: string;
  methodMatch: string;
  description: string;
  factory: StreamFactory;
}

const KNOWN_STREAMS: KnownStream[] = [
  {
    id: "state-sync.subscribe",
    serviceMatch: "StateSync",
    methodMatch: "Subscribe",
    description: "Projected state mutations across all plugins.",
    factory: () => stateSync.subscribe({ includeInitialState: true }),
  },
  {
    id: "plugin.signals",
    serviceMatch: "PluginService",
    methodMatch: "SubscribeSignals",
    description: "D-Bus signals fanned out through the gRPC mirror.",
    factory: () =>
      pluginService.subscribeSignals({ pluginId: "", signalNames: [], objectPath: "" }),
  },
  {
    id: "events.subscribe",
    serviceMatch: "EventChainService",
    methodMatch: "SubscribeEvents",
    description: "Audit-trail chain events.",
    factory: () =>
      eventChainService.subscribeEvents({ fromEventId: "0", pluginId: "", tags: [] }),
  },
  {
    id: "registry.watch",
    serviceMatch: "ComponentRegistry",
    methodMatch: "Watch",
    description: "Plugin component registry updates.",
    factory: () => componentRegistry.watch({}),
  },
  {
    id: "accountability.episodes",
    serviceMatch: "AccountabilityService",
    methodMatch: "SubscribeEpisodes",
    description: "Reasoning episodes for AI behaviour audit.",
    factory: () => accountabilityService.subscribeEpisodes({}),
  },
  {
    id: "mcp.events",
    serviceMatch: "McpService",
    methodMatch: "Subscribe",
    description: "MCP tool / resource events.",
    factory: () => mcpService.subscribe({}),
  },
];

function findKnownStream(service: string, method: string): KnownStream | undefined {
  return KNOWN_STREAMS.find(
    (s) =>
      service.includes(s.serviceMatch) &&
      method.toLowerCase() === s.methodMatch.toLowerCase(),
  );
}

const PAYLOAD_STORAGE_KEY = "network-control.payloads.v1";

function loadPayloads(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PAYLOAD_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function savePayloads(next: Record<string, string>) {
  try {
    localStorage.setItem(PAYLOAD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// ── reflectionTreeExplorer ───────────────────────────────────────────────

export const ReflectionTreeExplorerEl: El<"reflectionTreeExplorer"> = ({ props }) => {
  const registry = useReflectionRegistry(30_000);
  const { set } = useStateStore();
  const selection = useStateValue(NC.selection) as NetworkSelection | null | undefined;
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const selectMethod = (svc: ReflectedService, m: ReflectedMethod) => {
    const next: NetworkSelection = {
      serviceName: svc.name,
      methodName: m.name,
      key: methodKey(svc.name, m.name),
      inputType: m.inputType,
      outputType: m.outputType,
      clientStreaming: m.clientStreaming,
      serverStreaming: m.serverStreaming,
    };
    set(NC.selection, next);
  };

  const services: ReflectedService[] = useMemo(() => {
    const raw =
      registry.services.length > 0 ? registry.services : getStaticServiceCatalog();
    return raw.filter((s) => !isDeprecatedReflectionService(s.name));
  }, [registry.services]);
  const usingFallback = registry.services.length === 0 && !registry.loading;

  const filteredServices = useMemo(() => {
    if (!filter) return services;
    const needle = filter.toLowerCase();
    return services
      .map((s) => ({
        ...s,
        methods: s.methods.filter(
          (m) =>
            m.name.toLowerCase().includes(needle) ||
            s.name.toLowerCase().includes(needle) ||
            m.inputType.toLowerCase().includes(needle) ||
            m.outputType.toLowerCase().includes(needle),
        ),
      }))
      .filter((s) => s.methods.length > 0);
  }, [filter, services]);

  useEffect(() => {
    if (!filter) return;
    setExpanded(new Set(filteredServices.map((s) => s.name)));
  }, [filter, filteredServices]);

  // Default-select first codec-backed unary once services land.
  useEffect(() => {
    if (selection || services.length === 0) return;
    for (const svc of services) {
      for (const m of svc.methods) {
        if (!m.clientStreaming && !m.serverStreaming && hasCodec(svc.name, m.name)) {
          selectMethod(svc, m);
          setExpanded(new Set([svc.name]));
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, selection?.key]);

  const toggleGroup = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const filteredCount = filteredServices.reduce((n, s) => n + s.methods.length, 0);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[280px] h-full",
        props.className,
      )}
    >
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter methods…"
          className="h-7 text-xs font-mono border-0 bg-transparent focus-visible:ring-0 px-0"
        />
        <Badge variant="outline" className="text-[10px] font-mono">
          {filteredCount}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={registry.refresh}
          disabled={registry.loading}
          className="h-7 w-7 p-0"
          title="Refresh reflection"
        >
          <RefreshCw className={cn("h-3 w-3", registry.loading && "animate-spin")} />
        </Button>
      </div>
      {usingFallback && (
        <ReflectionFallbackBanner
          reason={registry.error}
          serviceCount={services.length}
          methodCount={services.reduce((n, s) => n + s.methods.length, 0)}
          onRetry={registry.refresh}
          retrying={registry.loading}
          className="m-2"
        />
      )}
      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {filteredServices.length === 0 && !registry.loading && (
            <div className="px-3 py-6 text-xs text-muted-foreground text-center">
              {registry.error ? "Reflection unavailable." : "No services discovered."}
            </div>
          )}
          {filteredServices.map((svc) => {
            const isOpen = expanded.has(svc.name);
            return (
              <div key={svc.name} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(svc.name)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/30 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className="font-mono text-xs font-semibold text-foreground truncate"
                    title={svc.name}
                  >
                    {svc.name}
                  </span>
                  <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                    {svc.methods.length}
                  </Badge>
                </button>
                {isOpen && (
                  <div className="ml-4 border-l border-border/50 pl-1.5 space-y-0.5">
                    {svc.methods.map((m: ReflectedMethod) => {
                      const key = methodKey(svc.name, m.name);
                      const streaming = m.clientStreaming || m.serverStreaming;
                      const invokable = !streaming && hasCodec(svc.name, m.name);
                      const active = selection?.key === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => selectMethod(svc, m)}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-md transition-colors font-mono text-[11px] truncate flex items-center gap-1.5",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                            !invokable && !streaming && !active && "opacity-60",
                          )}
                          title={
                            streaming
                              ? `${m.name} — server stream (tonic-web)`
                              : !invokable
                                ? `${m.name} — no local codec`
                                : `${m.name}(${m.inputType}) → ${m.outputType}`
                          }
                        >
                          <span className="truncate">{m.name}</span>
                          {streaming && <Radio className="h-2.5 w-2.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

// ── schemaFormBuilder ────────────────────────────────────────────────────

export const SchemaFormBuilderEl: El<"schemaFormBuilder"> = ({ props }) => {
  const selection = useStateValue(NC.selection) as NetworkSelection | null | undefined;
  const payloadsRef = useRef(loadPayloads());
  const [payload, setPayload] = useState("{}");
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!selection) {
      setPayload("{}");
      return;
    }
    setPayload(payloadsRef.current[selection.key] ?? "{}");
    setParseError(null);
  }, [selection?.key]);

  useEffect(() => {
    try {
      if (payload.trim() !== "") JSON.parse(payload);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
    }
  }, [payload]);

  const data = useMemo(() => {
    try {
      return payload.trim() === "" ? {} : JSON.parse(payload);
    } catch {
      return {};
    }
  }, [payload]);

  const schema: JsonSchema = useMemo(
    () => ({
      type: "object",
      title: selection?.inputType || "Request",
      additionalProperties: true,
    }),
    [selection?.inputType],
  );

  const onChange = (updated: unknown) => {
    try {
      const next = JSON.stringify(updated ?? {}, null, 2);
      setPayload(next);
      if (selection) {
        payloadsRef.current[selection.key] = next;
        savePayloads(payloadsRef.current);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("flex flex-col min-h-0 border border-border rounded-lg bg-card", props.className)}>
      <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/10 border-b border-border flex items-center gap-2">
        <span>{props.title ?? "Request schema"}</span>
        <Badge variant="outline" className="text-[10px] font-mono border-warning/40 text-warning">
          stub schema
        </Badge>
      </div>
      {!selection ? (
        <div className="p-3 text-xs text-muted-foreground">Select a method.</div>
      ) : (
        <div className="p-3 space-y-3 overflow-auto">
          <p className="text-[10px] text-muted-foreground">
            Open-object editor only — field schemas from FileDescriptorSet are not wired yet.
          </p>
          <SchemaRenderer schema={schema} data={data} onChange={onChange} />
          <Textarea
            value={payload}
            onChange={(e) => {
              setPayload(e.target.value);
              if (selection) {
                payloadsRef.current[selection.key] = e.target.value;
                savePayloads(payloadsRef.current);
              }
            }}
            spellCheck={false}
            className="min-h-[100px] font-mono text-xs"
            placeholder="{ }"
          />
          {parseError && (
            <div className="text-[10px] font-mono text-danger">Invalid JSON: {parseError}</div>
          )}
        </div>
      )}
    </div>
  );
};

// ── grpcMethodCaller ─────────────────────────────────────────────────────

type CallStatus = "idle" | "running" | "ok" | "error";

export const GrpcMethodCallerEl: El<"grpcMethodCaller"> = ({ props }) => {
  const selection = useStateValue(NC.selection) as NetworkSelection | null | undefined;
  const payloadsRef = useRef(loadPayloads());
  const [payload, setPayload] = useState("{}");
  const [status, setStatus] = useState<CallStatus>("idle");
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (!selection) return;
    setPayload(payloadsRef.current[selection.key] ?? "{}");
    setStatus("idle");
    setResponse(null);
    setError(null);
    setElapsedMs(null);
  }, [selection?.key]);

  const canInvoke =
    !!selection &&
    !selection.clientStreaming &&
    !selection.serverStreaming &&
    hasCodec(selection.serviceName, selection.methodName);

  const invoke = async () => {
    if (!selection || !canInvoke) return;
    let input: object;
    try {
      const parsed = payload.trim() === "" ? {} : JSON.parse(payload);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Request payload must be a JSON object");
      }
      input = parsed as object;
    } catch (e) {
      setStatus("error");
      setError(`Invalid JSON: ${(e as Error).message}`);
      setResponse(null);
      return;
    }

    payloadsRef.current[selection.key] = payload;
    savePayloads(payloadsRef.current);

    setStatus("running");
    setError(null);
    setResponse(null);
    setElapsedMs(null);
    const t0 = performance.now();
    try {
      const out = await callUnary(selection.serviceName, selection.methodName, input);
      setResponse(out);
      setStatus("ok");
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
      setStatus("error");
    } finally {
      setElapsedMs(performance.now() - t0);
    }
  };

  const clear = () => {
    setResponse(null);
    setError(null);
    setStatus("idle");
    setElapsedMs(null);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[280px] h-full",
        props.className,
      )}
    >
      {!selection ? (
        <div className="p-6 text-sm text-muted-foreground">No method selected.</div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-mono text-sm font-semibold text-foreground truncate">
                {selection.serviceName}.{selection.methodName}
              </span>
              {(selection.clientStreaming || selection.serverStreaming) && (
                <Badge variant="outline" className="text-[10px] font-mono border-info/40 text-info">
                  stream
                </Badge>
              )}
              {!hasCodec(selection.serviceName, selection.methodName) && (
                <Badge variant="outline" className="text-[10px] font-mono border-warning/40 text-warning">
                  no codec
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono",
                  status === "running" && "border-info/40 text-info",
                  status === "ok" && "border-success/40 text-success",
                  status === "error" && "border-danger/40 text-danger",
                )}
              >
                {status}
              </Badge>
              {elapsedMs !== null && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {elapsedMs.toFixed(0)}ms
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => void invoke()}
                disabled={status === "running" || !canInvoke}
                className="h-7 gap-1.5"
              >
                <Play className="h-3 w-3" /> Execute
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clear}
                disabled={status === "idle"}
                className="h-7 gap-1.5"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>
          </div>

          <div className="px-3 py-1.5 border-b border-border text-[10px] font-mono text-muted-foreground truncate">
            <span className="text-foreground">in</span> {selection.inputType || "?"}
            <span className="mx-2 text-border">→</span>
            <span className="text-foreground">out</span> {selection.outputType || "?"}
          </div>

          <div className="grid grid-rows-[minmax(140px,1fr)_1fr] flex-1 min-h-0">
            <div className="flex flex-col border-b border-border min-h-0">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/10">
                Request (JSON)
              </div>
              <Textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void invoke();
                  }
                }}
                spellCheck={false}
                className="flex-1 font-mono text-xs resize-none rounded-none border-0 focus-visible:ring-0 bg-transparent"
                placeholder="{ }"
              />
            </div>
            <div className="flex flex-col min-h-0">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/10">
                Response
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {error ? (
                  <div className="p-3 text-xs font-mono text-danger whitespace-pre-wrap">{error}</div>
                ) : response !== null ? (
                  <JsonRenderer data={response} fillHeight />
                ) : (
                  <div className="p-3 text-xs font-mono text-muted-foreground">
                    {status === "running"
                      ? "Executing…"
                      : canInvoke
                        ? "Press Execute (or ⌘/Ctrl+Enter)."
                        : "Unary + codec required — use the stream viewer for server streams."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── grpcStreamViewer ─────────────────────────────────────────────────────

type StreamStatus = "idle" | "streaming" | "paused" | "closed" | "canceled" | "error";

export const GrpcStreamViewerEl: El<"grpcStreamViewer"> = ({ props }) => {
  const selection = useStateValue(NC.selection) as NetworkSelection | null | undefined;
  const [messages, setMessages] = useState<unknown[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [frames, setFrames] = useState(0);
  const abortRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(false);
  const canceledRef = useRef(false);
  const bufferSize = 200;

  const known = selection
    ? findKnownStream(selection.serviceName, selection.methodName)
    : undefined;
  const isServerStream = !!selection?.serverStreaming;
  const unwiredStream = isServerStream && !known;

  useEffect(() => () => abortRef.current?.(), []);

  useEffect(() => {
    abortRef.current?.();
    abortRef.current = null;
    setMessages([]);
    setFrames(0);
    setError(null);
    setStatus("idle");
  }, [selection?.key]);

  const appendFrame = useCallback((value: unknown) => {
    setFrames((f) => f + 1);
    setMessages((prev) =>
      prev.length >= bufferSize ? [...prev.slice(-(bufferSize - 1)), value] : [...prev, value],
    );
  }, []);

  const start = async () => {
    if (!known) return;
    abortRef.current?.();
    pausedRef.current = false;
    canceledRef.current = false;
    setMessages([]);
    setFrames(0);
    setError(null);
    setStatus("streaming");
    try {
      const { stream, abort } = known.factory();
      abortRef.current = abort;
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!pausedRef.current) appendFrame(value);
      }
      setStatus(canceledRef.current ? "canceled" : "closed");
    } catch (e) {
      if (canceledRef.current) setStatus("canceled");
      else {
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
    setStatus("streaming");
  };

  const cancel = () => {
    canceledRef.current = true;
    pausedRef.current = false;
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
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[220px]",
        props.className,
      )}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-mono font-semibold truncate">
            {selection
              ? `${selection.serviceName}.${selection.methodName}`
              : "Stream viewer"}
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            tonic-web
          </Badge>
          {unwiredStream && (
            <Badge variant="outline" className="text-[10px] font-mono border-warning/40 text-warning">
              stub — no factory
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            {status} · {frames}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {!isLive ? (
            <Button
              size="sm"
              className="h-7 gap-1.5"
              disabled={!known}
              onClick={() => void start()}
              title={
                !isServerStream
                  ? "Select a server-streaming method"
                  : !known
                    ? "No wired stream factory for this method"
                    : known.description
              }
            >
              <Play className="h-3 w-3" /> Start
            </Button>
          ) : (
            <>
              {status === "streaming" ? (
                <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={pause}>
                  <Pause className="h-3 w-3" /> Pause
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={resume}>
                  <Play className="h-3 w-3" /> Resume
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={cancel}>
                <Square className="h-3 w-3" /> Stop
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={clear}>
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
      {error && (
        <div className="px-3 py-2 text-xs font-mono text-danger border-b border-border">{error}</div>
      )}
      {unwiredStream && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border border-l-2 border-l-warning/50 bg-warning/5">
          <span className="font-mono text-warning">stub</span>
          {" — "}server stream selected, but no client stream factory is wired yet. Known:{" "}
          {KNOWN_STREAMS.map((s) => s.id).join(", ")}.
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <JsonStreamRenderer messages={messages} loading={status === "streaming"} />
      </div>
    </div>
  );
};

/** Shared “this is a stub” chip — always visible when probe is not live. */
function StubBadge({ reason }: { reason: string }) {
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-mono shrink-0 border-warning/50 text-warning bg-warning/10"
      title={reason}
    >
      stub
    </Badge>
  );
}

// ── socketStatusPill ─────────────────────────────────────────────────────

export const SocketStatusPillEl: El<"socketStatusPill"> = ({ props }) => (
  <div
    className="inline-flex items-center gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 px-2.5 py-1.5"
    title={`STUB: browsers cannot open Unix domain sockets (${props.path})`}
  >
    <StatusDot status="offline" />
    <div className="min-w-0">
      <div className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
        {props.label}
      </div>
      <div className="text-[10px] font-mono text-muted-foreground truncate">{props.path}</div>
      <div className="text-[10px] text-warning/90">No live probe — host agent required</div>
    </div>
    <StubBadge reason="Unix socket health is not probed from the browser" />
  </div>
);

// ── tcpHealthBadge ───────────────────────────────────────────────────────

type TcpStatus = "checking" | "ok" | "down" | "stub";

/** Ports we can meaningfully probe from the browser (via tonic-web / HTTP). */
function liveProbeUrl(host: string, port: number): string | null {
  const prom =
    (import.meta.env.VITE_PROMETHEUS_URL as string | undefined) ||
    `http://${host}:9090`;
  const graf =
    (import.meta.env.VITE_GRAFANA_URL as string | undefined) ||
    `http://${host}:3000`;

  if (port === 8090) {
    const base =
      (typeof window !== "undefined" &&
        (window as unknown as { __OPDBUS_CONFIG__?: { grpcBaseUrl?: string } })
          .__OPDBUS_CONFIG__?.grpcBaseUrl) ||
      (import.meta.env.VITE_GRPC_BASE_URL as string | undefined) ||
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${String(base).replace(/\/+$/, "")}/grpc.reflection.v1.ServerReflection/ServerReflectionInfo`;
  }
  if (port === 9090) return `${prom.replace(/\/+$/, "")}/-/healthy`;
  if (port === 3000) return `${graf.replace(/\/+$/, "")}/api/health`;
  return null;
}

export const TcpHealthBadgeEl: El<"tcpHealthBadge"> = ({ props }) => {
  const [status, setStatus] = useState<TcpStatus>("checking");
  const [detail, setDetail] = useState<string>("");
  const probeUrl = liveProbeUrl(props.host, props.port);
  const isStub = probeUrl == null;

  useEffect(() => {
    if (isStub) {
      setStatus("stub");
      setDetail("no browser probe");
      return;
    }
    let cancelled = false;
    const probe = async () => {
      setStatus("checking");
      const t0 = performance.now();
      try {
        const res = await fetch(probeUrl, {
          method: props.port === 8090 ? "OPTIONS" : "GET",
          signal: AbortSignal.timeout(3000),
          mode: "cors",
        });
        // Any HTTP response means the endpoint answered (CORS/405 still = up for 8090).
        if (!cancelled) {
          const ok = props.port === 8090 ? res.status > 0 : res.ok;
          setStatus(ok ? "ok" : "down");
          setDetail(`${(performance.now() - t0).toFixed(0)}ms · HTTP ${res.status}`);
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("down");
          setDetail((e as Error).message || "unreachable");
        }
      }
    };
    void probe();
    const id = window.setInterval(() => void probe(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [props.host, props.port, probeUrl, isStub]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5",
        isStub
          ? "border-dashed border-warning/40 bg-warning/5"
          : "border-border",
      )}
      title={`${props.host}:${props.port}${probeUrl ? ` → ${probeUrl}` : " (stub)"}`}
    >
      <StatusDot
        status={
          status === "ok"
            ? "ok"
            : status === "checking"
              ? "warn"
              : status === "stub"
                ? "offline"
                : "error"
        }
      />
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{props.label}</div>
        <div className="text-[10px] font-mono text-muted-foreground truncate">
          {props.host}:{props.port}
          {detail ? ` · ${detail}` : ""}
        </div>
        {isStub && (
          <div className="text-[10px] text-warning/90">No live probe from browser</div>
        )}
      </div>
      {isStub ? (
        <StubBadge reason={`TCP ${props.port} has no browser-reachable health URL`} />
      ) : (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-mono shrink-0",
            status === "ok" && "border-success/40 text-success",
            status === "down" && "border-danger/40 text-danger",
          )}
        >
          {status}
        </Badge>
      )}
    </div>
  );
};

// ── networkTopologyGraph ─────────────────────────────────────────────────

interface TopoNodeData {
  label: string;
  component: string;
  status: "online" | "degraded" | "offline";
  icon: string;
  [key: string]: unknown;
}

const ICON_MAP: Record<string, typeof Shield> = { Shield, Globe, Zap, Radio };

function TopoNode({ data, selected }: NodeProps<Node<TopoNodeData>>) {
  const Icon = (typeof data.icon === "string" ? ICON_MAP[data.icon] : null) ?? Shield;
  const statusMap = { online: "ok", degraded: "warn", offline: "error" } as const;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-3 py-2 min-w-[140px]",
        selected ? "border-primary ring-1 ring-primary/30" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">{data.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusDot status={statusMap[data.status] ?? "offline"} />
        <span className="text-[10px] text-muted-foreground font-mono">{data.component}</span>
      </div>
    </div>
  );
}

const topoNodeTypes = { privacy: TopoNode, default: TopoNode };

export const NetworkTopologyGraphEl: El<"networkTopologyGraph"> = ({ props }) => {
  const { latestState } = useEventStore();

  const nodes = useMemo(() => {
    const raw =
      latestState["privacy.nodes"] ??
      latestState["privacy:nodes"] ??
      latestState["network.privacy"];
    if (Array.isArray(raw)) {
      return (raw as Node<TopoNodeData>[]).map((n) => ({
        ...n,
        type: n.type ?? "privacy",
        data: { ...n.data, icon: n.data?.icon ?? "Shield" },
      }));
    }
    return [] as Node<TopoNodeData>[];
  }, [latestState]);

  const edges = useMemo(() => {
    const raw =
      latestState["privacy.edges"] ??
      latestState["privacy:edges"] ??
      latestState["network.privacy_edges"];
    if (Array.isArray(raw)) return raw as Edge[];
    return [] as Edge[];
  }, [latestState]);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        props.className,
      )}
      style={{ height: props.height ?? "360px" }}
    >
      {nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No topology nodes yet. Waiting for live event-store data…
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={topoNodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="[&_.react-flow__background]:!bg-background"
        >
          <Background gap={20} size={1} className="opacity-30" />
          <Controls className="!bg-card !border-border !rounded-md [&_button]:!bg-card [&_button]:!border-border [&_button]:!text-foreground" />
          <MiniMap className="!bg-card !border-border" nodeColor="hsl(var(--primary))" />
        </ReactFlow>
      )}
    </div>
  );
};
