import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Card, Callout } from "@/components/shell/Primitives";
import { useBlobCatalog } from "@/hooks/use-blob-catalog";
import { Input } from "@/components/ui/input";
import { Package, Search } from "lucide-react";

/**
 * Every plugin in the live catalog: sealed blobs plus `/dev/shm/opdbus/state/`.
 * Not the build-time generated method index, and not the deprecated projection layer.
 */
export default function PluginsPage() {
  const { plugins, loading, error } = useBlobCatalog();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? plugins.filter((p) => p.toLowerCase().includes(q)) : plugins;
  }, [plugins, query]);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Plugins"
        subtitle="Blobs ∪ /dev/shm/opdbus/state/ — each page is rendered from that plugin's live schema"
      />

      {error && <Callout variant="danger">{error}</Callout>}

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter plugins…"
          className="pl-7 h-8 text-xs"
        />
      </div>

      <Card title={loading ? "Loading catalog…" : `${filtered.length} of ${plugins.length} plugins`}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((id) => (
            <Link
              key={id}
              to={`/plugin/${id}`}
              className="flex items-center gap-1.5 rounded border border-border bg-card/40 px-2 py-1.5 text-xs font-mono text-foreground hover:border-info/40 hover:text-info"
            >
              <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{id}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
