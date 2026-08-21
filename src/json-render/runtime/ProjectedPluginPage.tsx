import { useEffect, useState } from "react";
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { useJsonRender } from "./JsonRenderProvider";
import { fetchPluginSchema } from "@/lib/plugin-ui-surfaces";
import { schemaToSpec } from "@/components/PluginPage";
import {
  errorSpec,
  loadingSpec,
  projectionToSpec,
  type UiSubidProjection,
} from "@/json-render/projection";

/**
 * Renders one sealed plugin from GET /api/ui-model/plugin-schema/:id.
 * Spec types come from ui_projection roles; live values from StateSync.
 */
export function ProjectedPluginPage({ pluginId }: { pluginId: string }) {
  const { registry } = useJsonRender();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSpec(null);
    setError(null);

    fetchPluginSchema(pluginId)
      .then((envelope) => {
        if (cancelled) return;
        const rows = (envelope as { ui_projection?: UiSubidProjection[] }).ui_projection;
        if (Array.isArray(rows) && rows.length > 0) {
          setSpec(projectionToSpec(envelope.plugin, rows, envelope.schema_hash));
          return;
        }
        setSpec(schemaToSpec(envelope.schema as never, envelope.plugin));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [pluginId]);

  // Each branch renders <Renderer> in the same position, so without a distinct
  // key React reuses one instance across the loading -> resolved swap. Catalog
  // components are invoked as plain functions by defineRegistry, so their hooks
  // live in the shared ElementRenderer instance: when the element at a given
  // key changes type, its hook count changes and React throws #311 ("rendered
  // fewer hooks than expected"). Keying by branch forces a clean remount.
  if (error)
    return <Renderer key={`error:${pluginId}`} spec={errorSpec(pluginId, error)} registry={registry} />;
  if (!spec)
    return <Renderer key={`loading:${pluginId}`} spec={loadingSpec(pluginId)} registry={registry} />;
  return <Renderer key={`spec:${pluginId}`} spec={spec} registry={registry} />;
}
