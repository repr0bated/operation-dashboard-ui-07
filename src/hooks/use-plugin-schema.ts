import { useState, useEffect } from "react";

/**
 * Hook to read a plugin's schema from the sealed SHM blob catalog.
 * op-web serves it straight out of `op_blob::catalog::read_plugin_schema_shm`,
 * so a plugin exists here iff its blob is sealed.
 */
export function usePluginSchema(pluginId: string) {
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!pluginId) {
      setSchema(null);
      setError("no plugin id");
      setLoading(false);
      return;
    }

    async function loadSchema() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/plugin-schema/${pluginId}`);
        if (!response.ok) throw new Error(`Failed to load schema: ${response.statusText}`);
        const data = await response.json();
        if (!cancelled) setSchema(data);
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
  }, [pluginId]);

  return { schema, loading, error };
}
