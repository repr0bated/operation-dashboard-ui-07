import { useEffect, useState } from "react";
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { jsonRenderRegistry } from "@/lib/json-render-catalog";
import { usePluginSchema } from "@/hooks/use-plugin-schema";

/**
 * Dynamic plugin page - renders ANY plugin's UI from its PluginSchema.
 * Uses ONLY components in jsonRenderRegistry.
 */
export function PluginPage({ pluginId }: { pluginId: string }) {
  const { schema, loading, error } = usePluginSchema(pluginId);
  const [spec, setSpec] = useState<Spec | null>(null);

  useEffect(() => {
    if (!schema) return;
    
    // Convert PluginSchema to json-render spec using ONLY catalog components
    const generatedSpec = schemaToSpec(schema, pluginId);
    setSpec(generatedSpec);
  }, [schema, pluginId]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading {pluginId} schema...</div>;
  if (error) return <div className="p-6 text-danger">Error: {error}</div>;
  if (!spec) return <div className="p-6 text-muted-foreground">No schema available</div>;

  return (
    <div className="p-6">
      <Renderer spec={spec} registry={jsonRenderRegistry} />
    </div>
  );
}

/**
 * Convert a PluginSchema to a json-render Spec using ONLY catalog components.
 * Catalog has: container, card, kv, heading, text, badge, row, code
 */
function schemaToSpec(schema: any, pluginId: string): Spec {
  const elements: Record<string, any> = {};
  
  // Root container
  elements["root"] = {
    type: "container",
    children: ["header", "methods", "fields"],
  };

  // Header card
  elements["header"] = {
    type: "card",
    props: { title: schema.name || pluginId },
    children: ["version", "description"],
  };
  elements["version"] = {
    type: "kv",
    props: { label: "Version", value: schema.version || "unknown" },
  };
  elements["description"] = {
    type: "text",
    props: { text: schema.description || "No description" },
  };

  // Methods section
  if (schema.methods && schema.methods.length > 0) {
    const methodKeys = schema.methods.map((m: any, i: number) => {
      const key = `method-${i}`;
      elements[key] = {
        type: "badge",
        props: { text: m.name || `method-${i}`, tone: "info" },
      };
      return key;
    });
    elements["methods"] = {
      type: "card",
      props: { title: `Methods (${schema.methods.length})` },
      children: methodKeys,
    };
  }

  // Fields section
  if (schema.fields && schema.fields.length > 0) {
    const fieldKeys = schema.fields.map((f: any, i: number) => {
      const key = `field-${i}`;
      elements[key] = {
        type: "kv",
        props: { label: f.name || `field-${i}`, value: f.type || "unknown" },
      };
      return key;
    });
    elements["fields"] = {
      type: "card",
      props: { title: `Fields (${schema.fields.length})` },
      children: fieldKeys,
    };
  }

  return { root: "root", elements };
}
