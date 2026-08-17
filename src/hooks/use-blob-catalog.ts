import { useEffect, useMemo, useState } from "react";
import { resolveApiBase } from "@/lib/api";
import { useEventStore } from "@/stores/event-store";

/**
 * Every plugin actually present in the sealed blob catalog.
 *
 * `GET /api/ui-model/plugins` is the single source of truth: op-web reads the
 * SHM blob catalog, so a plugin appears here iff its `.blob` is sealed.
 *
 * Do NOT substitute the generated `PLUGIN_METHOD_BY_PLUGIN` index for this —
 * that map is produced by protobuf codegen at build time and silently omits
 * plugins with no generated method clients (antigravity among them), which is
 * how sealed blobs went missing from the Blobs page.
 */
export interface BlobCatalog {
  /** Sorted plugin ids from the sealed catalog. */
  plugins: string[];
  loading: boolean;
  error: string | null;
  /** True when the list came from the stream rather than the HTTP backstop. */
  live: boolean;
  /** Identity of the published catalog; changes when any contract is resealed. */
  catalogHash: string;
}

/** A partial stream must never hide entries from the sealed catalog manifest. */
export function mergeBlobCatalogPluginIds(
  manifestIds: string[],
  streamedIds: string[],
): string[] {
  return [...new Set([...manifestIds, ...streamedIds])].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function useBlobCatalog(): BlobCatalog {
  const [plugins, setPlugins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contracts hydrated from the StateSync stream may arrive incrementally or
  // reconnect partway through hydration. They enrich the manifest list but do
  // not replace it: only the HTTP manifest read proves enumeration is complete.
  const streamedPlugins = useEventStore((s) => s.schemas);
  const catalogHash = useEventStore((s) => s.catalogHash);
  const streamedIds = useMemo(
    () => Object.keys(streamedPlugins).sort((a, b) => a.localeCompare(b)),
    [streamedPlugins],
  );
  const catalogPlugins = useMemo(
    () => mergeBlobCatalogPluginIds(plugins, streamedIds),
    [plugins, streamedIds],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${resolveApiBase()}/ui-model/plugins`);
        if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);

        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          // An HTML body means the request fell through to the SPA fallback
          // rather than reaching the API.
          throw new Error(
            `catalog returned ${ct || "unknown type"}, not JSON — check the API base`,
          );
        }

        const body: { plugins?: unknown } = await res.json();
        if (!Array.isArray(body.plugins)) {
          throw new Error("catalog response has no `plugins` array");
        }
        const ids = body.plugins.filter((p): p is string => typeof p === "string");
        if (!cancelled) setPlugins([...ids].sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogHash]);

  return {
    plugins: catalogPlugins,
    loading,
    error,
    live: streamedIds.length > 0,
    catalogHash,
  };
}
