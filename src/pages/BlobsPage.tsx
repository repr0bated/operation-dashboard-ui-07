/**
 * Blobs — browse sealed plugin blob schemas.
 *
 * The plugin list comes from `GET /api/ui-model/plugins`, i.e. the sealed blob
 * catalog itself: a plugin is listed iff its `.blob` is sealed. Method clients
 * are intentionally not imported here: the generated registry pulls hundreds
 * of gRPC modules into the initial page graph and is unrelated to blob loading.
 */
import { useEffect, useMemo, useState } from "react";
import { PluginSchemaPanel } from "@/components/ui-model/PluginSchemaPanel";
import { useBlobCatalog } from "@/hooks/use-blob-catalog";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Package, Search, Loader2 } from "lucide-react";

export default function BlobsPage() {
  const { plugins: catalog, loading, error } = useBlobCatalog();

  const plugins = useMemo(
    () =>
      catalog.map((name) => ({ name })),
    [catalog],
  );

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");

  // Select a default once the catalog arrives, without clobbering a user pick.
  useEffect(() => {
    if (selected || plugins.length === 0) return;
    setSelected(
      plugins.find((p) => p.name === "antigravity_chat")?.name ?? plugins[0].name,
    );
  }, [plugins, selected]);

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
            {loading
              ? "reading sealed blob catalog…"
              : `${plugins.length} sealed plugins · /api/ui-model/plugins`}
          </p>
        </div>
      </header>

      {error && (
        <ErrorBanner
          title="Sealed blob catalog unavailable"
          message={error}
        />
      )}

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
            {loading && (
              <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading catalog…
              </div>
            )}
            {!loading && plugins.length === 0 && !error && (
              <div className="p-4 text-xs text-muted-foreground">
                No sealed blobs in the catalog.
              </div>
            )}
            {!loading && plugins.length > 0 && filtered.length === 0 && (
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
                <span className="text-[10px] text-muted-foreground/70">sealed</span>
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
            <EmptyState
              title="No plugin selected"
              hint="Pick a sealed blob from the list to view its schema."
            />
          )}
        </section>
      </div>
    </div>
  );
}
