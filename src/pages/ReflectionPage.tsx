/**
 * Reflection view.
 *
 * Talks to `grpc.reflection.v1.ServerReflection` on the bridge and renders
 * the live set of services + methods + messages currently registered. As
 * plugins register / de-register D-Bus objects, the underlying reflection
 * data changes; a 5s poll keeps the view in sync without a page reload.
 *
 * This is the schemaless counterpart to `GrpcExplorerPage`: instead of a
 * hand-curated invoke catalog, it shows *whatever is actually on the wire*.
 */
import { useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, RefreshCw, Radio, ArrowRight, Layers, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReflectionRegistry } from "@/hooks/use-reflection-registry";
import type { ReflectedMethod, ReflectedService } from "@/lib/reflection/client";

function methodKind(m: ReflectedMethod): string {
  if (m.clientStreaming && m.serverStreaming) return "bidi";
  if (m.serverStreaming) return "server-stream";
  if (m.clientStreaming) return "client-stream";
  return "unary";
}

function shortType(fq: string): string {
  const bare = fq.replace(/^\.+/, "");
  const parts = bare.split(".");
  return parts[parts.length - 1] || bare;
}

export default function ReflectionPage() {
  const { registry, loading, error, lastSyncAt, addedSinceLast, removedSinceLast, refresh } =
    useReflectionRegistry(5000);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byFile = new Map<string, ReflectedService[]>();
    for (const s of registry.services) {
      const arr = byFile.get(s.fileName) ?? [];
      arr.push(s);
      byFile.set(s.fileName, arr);
    }
    return [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [registry.services]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return grouped;
    const needle = filter.toLowerCase();
    const out: [string, ReflectedService[]][] = [];
    for (const [file, svcs] of grouped) {
      const matched = svcs.filter(
        (s) =>
          s.fullName.toLowerCase().includes(needle) ||
          file.toLowerCase().includes(needle) ||
          s.methods.some((m) => m.name.toLowerCase().includes(needle)),
      );
      if (matched.length) out.push([file, matched]);
    }
    return out;
  }, [grouped, filter]);

  const activeService = useMemo(
    () => registry.services.find((s) => s.fullName === selected) ?? null,
    [registry.services, selected],
  );

  const totalMethods = registry.services.reduce((n, s) => n + s.methods.length, 0);

  return (
    <>
      <PageHeader
        title="Reflection"
        subtitle="Live view of every gRPC service, method, and message currently registered on the bridge."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="h-7 gap-1.5"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Badge variant="outline" className="text-[10px] font-mono">
          {registry.services.length} services
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono">
          {totalMethods} methods
        </Badge>
        <Badge variant="outline" className="text-[10px] font-mono">
          {registry.files.length} files
        </Badge>
        {addedSinceLast.length > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono border-info/40 text-info">
            +{addedSinceLast.length} new
          </Badge>
        )}
        {removedSinceLast.length > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono border-warn/40 text-warn">
            −{removedSinceLast.length} gone
          </Badge>
        )}
        {lastSyncAt && (
          <span className="text-[11px] font-mono text-muted-foreground">
            last sync {new Date(lastSyncAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-md border border-danger/40 bg-danger/5 text-xs font-mono text-danger">
          reflection: {error}
        </div>
      )}

      <div
        className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4"
        style={{ minHeight: "calc(100vh - 260px)" }}
      >
        {/* Service tree */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Services
            </span>
          </div>
          <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 bg-muted/10">
            <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter service / method / file…"
              className="h-7 text-xs font-mono"
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {loading && !registry.services.length && (
                <div className="text-[11px] font-mono text-muted-foreground px-2 py-4">
                  Reflecting the bridge…
                </div>
              )}
              {!loading && !registry.services.length && !error && (
                <div className="text-[11px] font-mono text-muted-foreground px-2 py-4">
                  No services registered. Plugins that expose D-Bus objects will
                  appear here as soon as the bridge sees them.
                </div>
              )}
              {filtered.map(([file, svcs]) => (
                <div key={file}>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    <FileCode className="h-3 w-3" />
                    <span className="truncate">{file || "(no file)"}</span>
                  </div>
                  <div className="space-y-0.5">
                    {svcs.map((s) => (
                      <button
                        key={s.fullName}
                        onClick={() => setSelected(s.fullName)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md transition-colors border",
                          selected === s.fullName
                            ? "border-primary/40 bg-primary/10"
                            : "border-transparent hover:bg-muted/30",
                          addedSinceLast.includes(s.fullName) && "ring-1 ring-info/40",
                        )}
                      >
                        <div className="text-xs font-mono font-semibold text-foreground truncate">
                          {shortType(s.fullName)}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate">
                          {s.packageName || "(no package)"} · {s.methods.length} method
                          {s.methods.length === 1 ? "" : "s"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          {!activeService ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center text-xs font-mono text-muted-foreground max-w-md">
                <Radio className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                Select a service from the left to inspect its methods and message
                shapes. The list refreshes automatically as plugins register or
                withdraw D-Bus objects.
              </div>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm font-semibold text-foreground truncate">
                    {activeService.fullName}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {activeService.methods.length} methods
                  </Badge>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  {activeService.fileName}
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  <div className="rounded-md border border-border">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="text-left px-3 py-1.5">Method</th>
                          <th className="text-left px-3 py-1.5">Kind</th>
                          <th className="text-left px-3 py-1.5">Input</th>
                          <th className="text-left px-3 py-1.5"></th>
                          <th className="text-left px-3 py-1.5">Output</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeService.methods.map((m) => {
                          const kind = methodKind(m);
                          return (
                            <tr
                              key={m.name}
                              className="border-b border-border/50 last:border-0 hover:bg-muted/10"
                            >
                              <td className="px-3 py-1.5 text-foreground font-semibold">
                                {m.name}
                              </td>
                              <td className="px-3 py-1.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-mono",
                                    kind === "server-stream" && "border-info/40 text-info",
                                    kind === "bidi" && "border-warn/40 text-warn",
                                  )}
                                >
                                  {kind}
                                </Badge>
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[220px]">
                                {shortType(m.inputType)}
                              </td>
                              <td className="px-1 py-1.5 text-muted-foreground/50">
                                <ArrowRight className="h-3 w-3" />
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[220px]">
                                {shortType(m.outputType)}
                              </td>
                            </tr>
                          );
                        })}
                        {!activeService.methods.length && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-4 text-center text-muted-foreground"
                            >
                              This service exposes no methods.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Referenced message shapes */}
                  <Card title="Referenced messages">
                    <div className="space-y-3">
                      {(() => {
                        const refs = new Set<string>();
                        for (const m of activeService.methods) {
                          if (m.inputType) refs.add(m.inputType.replace(/^\.+/, ""));
                          if (m.outputType) refs.add(m.outputType.replace(/^\.+/, ""));
                        }
                        const rendered = [...refs]
                          .map((r) => registry.messages.get(r))
                          .filter((m): m is NonNullable<typeof m> => !!m);
                        if (!rendered.length) {
                          return (
                            <div className="text-[11px] font-mono text-muted-foreground">
                              No local message descriptors are cached for this service yet.
                            </div>
                          );
                        }
                        return rendered.map((msg) => (
                          <div key={msg.fullName} className="rounded-md border border-border">
                            <div className="px-3 py-1.5 border-b border-border bg-muted/20 text-xs font-mono font-semibold">
                              {msg.fullName}
                            </div>
                            <table className="w-full text-xs font-mono">
                              <tbody>
                                {msg.fields.map((f) => (
                                  <tr
                                    key={f.number}
                                    className="border-b border-border/40 last:border-0"
                                  >
                                    <td className="px-3 py-1 text-muted-foreground w-8 text-right">
                                      {f.number}
                                    </td>
                                    <td className="px-2 py-1 text-foreground">{f.name}</td>
                                    <td className="px-2 py-1 text-muted-foreground">
                                      {f.label === "repeated" ? "repeated " : ""}
                                      {f.type === "message" || f.type === "enum"
                                        ? shortType(f.typeName)
                                        : f.type}
                                    </td>
                                  </tr>
                                ))}
                                {!msg.fields.length && (
                                  <tr>
                                    <td
                                      colSpan={3}
                                      className="px-3 py-2 text-center text-muted-foreground"
                                    >
                                      (empty message)
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        ));
                      })()}
                    </div>
                  </Card>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </>
  );
}
