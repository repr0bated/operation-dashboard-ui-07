import { useState, useEffect } from "react";
import { gRPCClient } from "@/grpc/client";

/**
 * Hook to read a plugin's schema from the sealed SHM blob catalog.
 * Uses gRPC to call the plugin method that reads the schema.
 */
export function usePluginSchema(pluginId: string) {
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSchema() {
      try {
        setLoading(true);
        // Call the gRPC method to get plugin schema
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

    loadSchema();
    return () => { cancelled = true; };
  }, [pluginId]);

  return { schema, loading, error };
}
