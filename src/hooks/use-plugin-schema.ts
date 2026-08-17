import { useEffect, useState } from "react";
import { resolveApiBase } from "@/lib/api";
import { useEventStore } from "@/stores/event-store";

/**
 * A plugin's sealed contract.
 *
 * The stream is the source: the mutation engine publishes every contract on
 * `StateSync.Subscribe` at hydration and again whenever a plugin is resealed,
 * carrying the exact JSON that was sealed into the blob. Holding it here means
 * the UI renders what the engine published rather than what a separate read of
 * SHM happened to return.
 *
 * The HTTP route remains as a fallback for the case where this hook is used
 * before the stream has hydrated — a page deep-linked on load, or the stream
 * still reconnecting. It is a backstop, not the path: once a contract has
 * arrived on the stream it always wins, including after a reseal, which the
 * fetch would not have noticed.
 */
export function usePluginSchema(pluginId: string) {
  const streamedSchema = useEventStore((s) => (pluginId ? s.schemas[pluginId] : undefined));
  const isStale = useEventStore((s) => s.staleSchemas.includes(pluginId));
  const [fetchedSchema, setFetchedSchema] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!pluginId) {
      setFetchedSchema(null);
      setError("no plugin id");
      setLoading(false);
      return;
    }

    // The stream already delivered it; do not fetch.
    if (streamedSchema !== undefined) {
      setError(null);
      setLoading(false);
      return;
    }

    async function loadSchema() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${resolveApiBase()}/plugin-schema/${encodeURIComponent(pluginId)}`);
        if (!response.ok) throw new Error(`Failed to load schema: ${response.statusText}`);
        const ct = response.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          // An HTML body here means the request fell through to the SPA
          // fallback instead of reaching the API.
          throw new Error(`schema returned ${ct || "unknown type"}, not JSON — check the API base`);
        }
        const data = await response.json();
        if (!cancelled) setFetchedSchema(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSchema();
    return () => {
      cancelled = true;
    };
  }, [pluginId, streamedSchema]);

  return {
    schema: streamedSchema !== undefined ? streamedSchema : fetchedSchema,
    loading,
    error,
    /** True when the contract came from the stream rather than the HTTP backstop. */
    live: streamedSchema !== undefined,
    /** True when values have cited a contract this client never received. */
    stale: isStale,
  };
}
