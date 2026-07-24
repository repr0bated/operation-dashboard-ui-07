/**
 * Blobs — browse sealed plugin blob schemas.
 *
 * Lists every plugin discovered in the auto-generated plugin-methods index and
 * renders the currently selected plugin's sealed-blob schema through
 * PluginSchemaPanel (fetched from /api/gemma/plugin-schema/:plugin).
 */
import { useMemo, useState } from "react";
import { PLUGIN_METHOD_BY_PLUGIN } from "@/grpc/plugin-methods";
import { PluginSchemaPanel } from "@/components/gemma/PluginSchemaPanel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Package, Search } from "lucide-react";

export default function BlobsPage() {
  const plugins = useMemo(
    () =>
      Array.from(PLUGIN_METHOD_BY_PLUGIN.entries())
        .map(([name, entries]) => ({ name, count: entries.length }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(
    plugins.find((p) => p.name === "antigravity_chat")?.name ??
      plugins[0]?.name ??
      "",
  );

  const filtered = plugins.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            Sealed Blobs
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {plugins.length} plugins · sealed-blob schemas served from
            /api/gemma/plugin-schema/:plugin
          </p>
        </div>
      </header>

      <div className="grid grid-cols-[280px_1fr] gap-4 min-h-[calc(100vh-180px)]">
        <aside className="rounded-lg border border-border bg-card/40 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter plugins…"
                className="h-8 pl-7 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">
                No plugins match "{query}".
              </div>
            )}
            {filtered.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelected(p.name)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-mono border-l-2 transition-colors",
                  selected === p.name
                    ? "bg-primary/10 border-primary text-foreground"
                    : "border-transparent hover:bg-muted/40 text-muted-foreground",
                )}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground/70">
                  {p.count}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-lg border border-border bg-card/40 p-4 overflow-hidden flex flex-col min-h-0">
          {selected ? (
            <PluginSchemaPanel
              plugin={selected}
              title={`${selected} · sealed blob`}
              className="flex-1 flex flex-col min-h-0"
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              Select a plugin to view its sealed-blob schema.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
