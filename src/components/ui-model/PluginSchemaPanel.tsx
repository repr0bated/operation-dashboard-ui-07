/**
 * Renders a plugin's live sealed-blob schema via json-render. The schema is the
 * render source — fetched from `/api/ui-model/plugin-schema/:plugin`, which reads
 * the sealed blob catalog. Chat/Assistant pass the selected provider plugin —
 * never a hardcoded antigravity_chat / Gemini blob.
 */
import { useEffect, useState } from "react";
import { JsonRenderer } from "@/components/json/JsonRenderer";
import { resolveApiBase } from "@/lib/api";
import { providerPluginSchema } from "@/lib/zeroclaw-routing";

interface Props {
  plugin: string;
  title?: string;
  className?: string;
}

interface SchemaResponse {
  plugin: string;
  schema_hash?: string;
  schema: unknown;
}

export function PluginSchemaPanel({
  plugin,
  title,
  className,
}: Props) {
  const pluginId = providerPluginSchema(plugin) ?? plugin;
  const [schema, setSchema] = useState<unknown>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`${resolveApiBase()}/ui-model/plugin-schema/${pluginId}`);
        if (!r.ok) throw new Error(`schema HTTP ${r.status}`);
        const j: SchemaResponse = await r.json();
        if (!alive) return;
        setSchema(j.schema ?? j);
        setHash(j.schema_hash ?? null);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pluginId]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title ?? `${pluginId} schema`}
        </span>
        {hash && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {hash.slice(0, 12)}
          </span>
        )}
      </div>
      {loading && <div className="text-xs text-muted-foreground">Loading schema…</div>}
      {error && (
        <div className="text-xs text-danger">Failed to load blob schema: {error}</div>
      )}
      {!loading && !error && schema != null && (
        <JsonRenderer data={schema} defaultMode="tree" maxDepth={4} fillHeight />
      )}
    </div>
  );
}
