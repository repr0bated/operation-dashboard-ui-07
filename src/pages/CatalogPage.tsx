import { useCallback, useEffect, useState } from "react";
import type { Spec } from "@json-render/core";
import { PageHeader, Card, Callout } from "@/components/shell/Primitives";
import { SpecRenderer } from "@/components/gemma/SpecRenderer";

interface CatalogEntry {
  id: string;
  spec: Spec;
  prompt: string;
  tags: string[];
  created_at: number;
  signature: string;
  promoted_at: number;
  label?: string | null;
}

interface Catalog {
  version: number;
  entries: CatalogEntry[];
}

export default function CatalogPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/gemma/catalog");
      if (!r.ok) throw new Error(`catalog HTTP ${r.status}`);
      const c: Catalog = await r.json();
      setEntries(c.entries ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/gemma/catalog/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error(`delete HTTP ${r.status}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gemma Catalog"
        subtitle="Finalized json-render specs promoted from the gallery."
      />
      {error && <Callout variant="danger">{error}</Callout>}
      {loading && entries.length === 0 && (
        <div className="text-sm text-muted-foreground">Loading catalog…</div>
      )}
      {!loading && entries.length === 0 && !error && (
        <Callout variant="default">
          No promoted specs yet. Promote specs from the Gallery.
        </Callout>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {entries.map((entry) => (
          <Card
            key={entry.id}
            title={entry.label || entry.id}
            actions={
              <button
                disabled={busy === entry.id}
                onClick={() => void remove(entry.id)}
                className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-muted/30 disabled:opacity-50"
              >
                Remove
              </button>
            }
          >
            <div className="rounded-md border border-border bg-background/40 p-2 max-h-[360px] overflow-auto">
              <SpecRenderer spec={entry.spec} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
