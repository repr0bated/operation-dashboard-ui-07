import { useEffect, useState } from "react";
import { loadCatalogPluginIds } from "@/lib/blob-catalog";

/**
 * Every plugin in the live catalog: sealed blobs plus present-state files
 * under `/dev/shm/opdbus/state/`. Not the deprecated projection layer, and
 * not the generated `PLUGIN_METHOD_BY_PLUGIN` index (that omits plugins with
 * no method clients, which is how antigravity disappeared from Blobs).
 */
export interface BlobCatalog {
  /** Sorted plugin ids from blobs ∪ `/dev/shm/opdbus/state/`. */
  plugins: string[];
  loading: boolean;
  error: string | null;
}

export function useBlobCatalog(): BlobCatalog {
  const [plugins, setPlugins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const ids = await loadCatalogPluginIds();
        if (!cancelled) setPlugins(ids);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { plugins, loading, error };
}
