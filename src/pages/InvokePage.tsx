/**
 * Invoke — unary gRPC method console.
 *
 * Enumerates every generated plugin method from PLUGIN_METHOD_ENTRIES,
 * lets the operator edit a JSON request payload, and renders the response
 * (or error) inline. Complements /explorer, which handles server-streaming.
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
import { Play, Trash2, Search, ChevronRight, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { pluginMethods, PLUGIN_METHOD_ENTRIES, type PluginMethodEntry } from "@/grpc/plugin-methods";

type Status = "idle" | "running" | "ok" | "error";

const STORAGE_KEY = "invoke.settings.v1";

interface PersistedPayloads {
  [typeName: string]: string;
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
    // ignore quota / private-mode
  }
}

const groupedByPlugin = (() => {
  const groups = new Map<string, PluginMethodEntry[]>();
  for (const e of PLUGIN_METHOD_ENTRIES) {
    const arr = groups.get(e.plugin) ?? [];
    arr.push(e);
    groups.set(e.plugin, arr);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
})();

export default function InvokePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTypeName = searchParams.get("m") ?? PLUGIN_METHOD_ENTRIES[0]?.typeName ?? "";

  const [selectedTypeName, setSelectedTypeName] = useState(initialTypeName);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const entry = PLUGIN_METHOD_ENTRIES.find((e) => e.typeName === initialTypeName);
    return new Set(entry ? [entry.plugin] : []);
  });

  const payloadsRef = useRef<PersistedPayloads>(loadPayloads());
  const [payload, setPayload] = useState<string>(payloadsRef.current[initialTypeName] ?? "{}");
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const selected = useMemo(
    () => PLUGIN_METHOD_ENTRIES.find((e) => e.typeName === selectedTypeName) ?? PLUGIN_METHOD_ENTRIES[0],
    [selectedTypeName],
  );

  // Persist selection to URL; load payload for the new method.
  useEffect(() => {
    if (!selected) return;
    const next = new URLSearchParams(searchParams);
    next.set("m", selected.typeName);
    setSearchParams(next, { replace: true });
    setPayload(payloadsRef.current[selected.typeName] ?? "{}");
    setStatus("idle");
    setResponse(null);
    setError(null);
    setElapsedMs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.typeName]);

  const filteredGroups = useMemo(() => {
    if (!filter) return groupedByPlugin;
    const needle = filter.toLowerCase();
    return groupedByPlugin
      .map(([plugin, entries]) => {
        const matched = entries.filter(
          (e) =>
            e.method.toLowerCase().includes(needle) ||
            e.typeName.toLowerCase().includes(needle) ||
            (e.subid ?? "").toLowerCase().includes(needle) ||
            plugin.toLowerCase().includes(needle),
        );
        return [plugin, matched] as const;
      })
      .filter(([, entries]) => entries.length > 0);
  }, [filter]);

  // Auto-expand groups when filtering surfaces matches.
  useEffect(() => {
    if (!filter) return;
    setExpanded(new Set(filteredGroups.map(([p]) => p)));
  }, [filter, filteredGroups]);

  const toggleGroup = (plugin: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(plugin)) next.delete(plugin);
      else next.add(plugin);
      return next;
    });

  const invoke = async () => {
    if (!selected) return;
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

    // Persist the last-good payload for this method.
    payloadsRef.current[selected.typeName] = payload;
    savePayloads(payloadsRef.current);

    setStatus("running");
    setError(null);
    setResponse(null);
    setElapsedMs(null);
    const t0 = performance.now();
    try {
      const out = await pluginMethods.callTypeName(
        `${selected.typeName}/${selected.method}`,
        input,
      );
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
        subtitle={`Call any of ${PLUGIN_METHOD_ENTRIES.length} generated plugin RPCs directly.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
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
              {filteredGroups.reduce((n, [, es]) => n + es.length, 0)}
            </Badge>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1.5">
              {filteredGroups.map(([plugin, entries]) => {
                const isOpen = expanded.has(plugin);
                return (
                  <div key={plugin} className="mb-0.5">
                    <button
                      onClick={() => toggleGroup(plugin)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/30 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-xs font-semibold text-foreground truncate">{plugin}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                        {entries.length}
                      </Badge>
                    </button>
                    {isOpen && (
                      <div className="ml-4 border-l border-border/50 pl-1.5 space-y-0.5">
                        {entries.map((e) => (
                          <button
                            key={e.typeName}
                            onClick={() => setSelectedTypeName(e.typeName)}
                            className={cn(
                              "w-full text-left px-2 py-1 rounded-md transition-colors font-mono text-[11px] truncate",
                              selected?.typeName === e.typeName
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                            )}
                            title={e.subid ?? undefined}
                          >
                            {e.method}
                          </button>
                        ))}
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
          {!selected ? (
            <div className="p-6 text-sm text-muted-foreground">No method selected.</div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-mono text-sm font-semibold text-foreground truncate">
                    {selected.plugin}.{selected.method}
                  </span>
                  {selected.subid && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {selected.subid}
                    </Badge>
                  )}
                  {selected.capability && (
                    <Badge variant="outline" className="text-[10px] font-mono border-info/40 text-info">
                      {selected.capability}
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
                    disabled={status === "running"}
                    className="h-7 gap-1.5"
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
                {selected.typeName}
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
                    placeholder='{ }'
                  />
                </div>

                {/* Response */}
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
                          ? "Invoking…"
                          : "Press Invoke (or ⌘/Ctrl+Enter) to call this method."}
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
