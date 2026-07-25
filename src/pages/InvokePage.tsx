/**
 * Invoke — unary gRPC method console.
 *
 * The method picker is populated by *live gRPC server reflection* —
 * `grpc.reflection.v1.ServerReflection/ServerReflectionInfo` — so it
 * reflects whatever the backend currently exposes (D-Bus plugins register
 * services dynamically). The static plugin index is no longer consulted.
 *
 * Invocation still requires a compile-time protobuf codec (encode request
 * bytes / decode response bytes). Methods without a codec are shown but
 * greyed out — hover their tooltip for the reason.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { JsonRenderer } from "@/components/json/JsonRenderer";
import {
  Play,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  Zap,
  RefreshCw,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { callUnary, hasCodec, getStaticServiceCatalog } from "@/grpc/client";
import {
  useReflectionRegistry,
  type ReflectedMethod,
  type ReflectedService,
} from "@/hooks/use-reflection-registry";

type Status = "idle" | "running" | "ok" | "error";

const STORAGE_KEY = "invoke.payloads.v2";

interface PersistedPayloads {
  [key: string]: string; // key = "service/method"
}

function loadPayloads(): PersistedPayloads {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedPayloads) : {};
  } catch {
    return {};
  }
}

function savePayloads(next: PersistedPayloads) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

interface Selection {
  service: ReflectedService;
  method: ReflectedMethod;
  key: string; // service.name + "/" + method.name
}

function methodKey(s: ReflectedService, m: ReflectedMethod) {
  return `${s.name}/${m.name}`;
}

export default function InvokePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const registry = useReflectionRegistry(30_000);

  // Static fallback: when reflection fails or returns nothing, drive the
  // picker from the compiled protobuf-ts codec registry so the console stays
  // usable even if the backend proxy doesn't expose ServerReflection.
  const services: ReflectedService[] = useMemo(() => {
    if (registry.services.length > 0) return registry.services;
    return getStaticServiceCatalog();
  }, [registry.services]);
  const usingFallback = registry.services.length === 0 && !registry.loading;

  const [selectedKey, setSelectedKey] = useState<string>(searchParams.get("m") ?? "");
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const payloadsRef = useRef<PersistedPayloads>(loadPayloads());
  const [payload, setPayload] = useState<string>("{}");
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  // Resolve the current selection out of the live registry each render.
  const selection = useMemo<Selection | null>(() => {
    for (const svc of registry.services) {
      for (const m of svc.methods) {
        if (methodKey(svc, m) === selectedKey) {
          return { service: svc, method: m, key: selectedKey };
        }
      }
    }
    // Default to first method with a codec once reflection lands.
    for (const svc of registry.services) {
      for (const m of svc.methods) {
        if (hasCodec(svc.name, m.name)) {
          const key = methodKey(svc, m);
          return { service: svc, method: m, key };
        }
      }
    }
    // Or the first method at all.
    const first = registry.services.find((s) => s.methods.length > 0);
    if (first) {
      const m = first.methods[0];
      return { service: first, method: m, key: methodKey(first, m) };
    }
    return null;
  }, [registry.services, selectedKey]);

  // Sync URL + payload when selection changes.
  useEffect(() => {
    if (!selection) return;
    if (searchParams.get("m") !== selection.key) {
      const next = new URLSearchParams(searchParams);
      next.set("m", selection.key);
      setSearchParams(next, { replace: true });
    }
    setPayload(payloadsRef.current[selection.key] ?? "{}");
    setStatus("idle");
    setResponse(null);
    setError(null);
    setElapsedMs(null);
    // Auto-expand the containing service group.
    setExpanded((prev) => {
      if (prev.has(selection.service.name)) return prev;
      const next = new Set(prev);
      next.add(selection.service.name);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.key]);

  const filteredServices = useMemo(() => {
    if (!filter) return registry.services;
    const needle = filter.toLowerCase();
    return registry.services
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
  }, [filter, registry.services]);

  useEffect(() => {
    if (!filter) return;
    setExpanded(new Set(filteredServices.map((s) => s.name)));
  }, [filter, filteredServices]);

  const toggleGroup = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const totalMethods = registry.services.reduce((n, s) => n + s.methods.length, 0);
  const filteredCount = filteredServices.reduce((n, s) => n + s.methods.length, 0);

  const canInvoke =
    !!selection &&
    !selection.method.clientStreaming &&
    !selection.method.serverStreaming &&
    hasCodec(selection.service.name, selection.method.name);

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
      const out = await callUnary(selection.service.name, selection.method.name, input);
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
    <>
      <PageHeader
        title="Invoke"
        subtitle={
          registry.loading && totalMethods === 0
            ? "Discovering services via gRPC reflection…"
            : registry.error
              ? `Reflection error — ${registry.error}`
              : `Live reflection · ${registry.services.length} services · ${totalMethods} methods`
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={registry.refresh}
            disabled={registry.loading}
            className="h-7 gap-1.5"
          >
            <RefreshCw className={cn("h-3 w-3", registry.loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4"
        style={{ minHeight: "calc(100vh - 220px)" }}
      >
        {/* Method list */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-0">
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
          </div>
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
                        {svc.methods.map((m) => {
                          const key = methodKey(svc, m);
                          const streaming = m.clientStreaming || m.serverStreaming;
                          const invokable = !streaming && hasCodec(svc.name, m.name);
                          const active = selection?.key === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedKey(key)}
                              className={cn(
                                "w-full text-left px-2 py-1 rounded-md transition-colors font-mono text-[11px] truncate flex items-center gap-1.5",
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                                !invokable && !active && "opacity-60",
                              )}
                              title={
                                streaming
                                  ? `${m.name} — streaming, use /explorer`
                                  : !invokable
                                    ? `${m.name} — no local codec (unknown proto)`
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

        {/* Detail */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-0">
          {!selection ? (
            <div className="p-6 text-sm text-muted-foreground">
              {registry.loading ? "Loading reflection…" : "No method selected."}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono text-sm font-semibold text-foreground truncate">
                    {selection.service.name}.{selection.method.name}
                  </span>
                  {(selection.method.clientStreaming || selection.method.serverStreaming) && (
                    <Badge variant="outline" className="text-[10px] font-mono border-info/40 text-info">
                      {selection.method.clientStreaming && selection.method.serverStreaming
                        ? "bidi stream"
                        : selection.method.clientStreaming
                          ? "client stream"
                          : "server stream"}
                    </Badge>
                  )}
                  {!hasCodec(selection.service.name, selection.method.name) && (
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
                    onClick={invoke}
                    disabled={status === "running" || !canInvoke}
                    className="h-7 gap-1.5"
                    title={
                      !canInvoke
                        ? "Streaming or codec-less methods cannot be invoked from this console."
                        : undefined
                    }
                  >
                    <Play className="h-3 w-3" /> Invoke
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
                <span className="text-foreground">in</span> {selection.method.inputType || "?"}
                <span className="mx-2 text-border">→</span>
                <span className="text-foreground">out</span> {selection.method.outputType || "?"}
              </div>

              <div className="grid grid-rows-[minmax(160px,1fr)_1fr] flex-1 min-h-0">
                {/* Request */}
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

                {/* Response */}
                <div className="flex flex-col min-h-0">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/10">
                    Response
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {error ? (
                      <div className="p-3 text-xs font-mono text-danger whitespace-pre-wrap">
                        {error}
                      </div>
                    ) : response !== null ? (
                      <JsonRenderer data={response} fillHeight />
                    ) : (
                      <div className="p-3 text-xs font-mono text-muted-foreground">
                        {status === "running"
                          ? "Invoking…"
                          : canInvoke
                            ? "Press Invoke (or ⌘/Ctrl+Enter) to call this method."
                            : "This method cannot be invoked from the console."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
