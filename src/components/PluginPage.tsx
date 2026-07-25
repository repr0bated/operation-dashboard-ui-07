import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { jsonRenderRegistry } from "@/lib/json-render-catalog";
import { usePluginSchema } from "@/hooks/use-plugin-schema";

/**
 * Dynamic plugin page - renders ANY plugin's UI from its sealed PluginSchema.
 * Uses ONLY components in jsonRenderRegistry.
 */
export function PluginPage({ pluginId }: { pluginId?: string }) {
  const params = useParams<{ pluginId: string }>();
  const id = pluginId ?? params.pluginId ?? "";
  const { schema, loading, error } = usePluginSchema(id);
  const [spec, setSpec] = useState<Spec | null>(null);

  useEffect(() => {
    if (!schema) {
      setSpec(null);
      return;
    }
    setSpec(schemaToSpec(schema, id));
  }, [schema, id]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading {id} schema…</div>;
  if (error) return <div className="p-6 text-danger">Error: {error}</div>;
  if (!spec) return <div className="p-6 text-muted-foreground">No schema available</div>;

  return (
    <div className="p-6">
      <Renderer spec={spec} registry={jsonRenderRegistry} />
    </div>
  );
}

export default PluginPage;

/**
 * Sealed-blob PluginSchema shapes. `fields` and `methods` arrive as maps keyed
 * by name, not arrays.
 */
interface SchemaField {
  field_type?: string | Record<string, unknown>;
  description?: string | null;
  required?: boolean;
  read_only?: boolean;
  default?: unknown;
}

interface SchemaMethod {
  name?: string;
  side_effect?: string;
  subid?: string;
  required_capability?: string | null;
  idempotent?: boolean;
}

interface PluginSchemaShape {
  name?: string;
  display_name?: string | null;
  version?: string;
  category?: string;
  description?: string;
  tags?: string[];
  dependencies?: string[];
  fields?: Record<string, SchemaField> | SchemaField[];
  methods?: Record<string, SchemaMethod> | SchemaMethod[];
  guarantees?: Record<string, boolean>;
}

type FieldType = string | Record<string, unknown> | undefined;

/** Readable name for a field type: "integer", "object", "array<object>". */
function typeLabel(ft: FieldType): string {
  if (!ft) return "unknown";
  if (typeof ft === "string") return ft;
  const [kind, inner] = Object.entries(ft)[0] ?? [];
  if (kind === "array") return `array<${typeLabel(inner as FieldType)}>`;
  if (kind === "enum") return "enum";
  if (kind === "oneOf") return "oneOf";
  return kind ?? "unknown";
}

/** The primitive name, for KV's colour coding. Nested shapes have none. */
function primitiveOf(ft: FieldType): string | undefined {
  return typeof ft === "string" ? ft : undefined;
}

/** Subfields when the type is an object, else null. */
function objectShape(ft: FieldType): Record<string, SchemaField> | null {
  if (!ft || typeof ft === "string") return null;
  const obj = (ft as { object?: Record<string, SchemaField> }).object;
  return obj ?? null;
}

/** Column shape when the type is an array of objects, else null. */
function arrayRowShape(ft: FieldType): Record<string, SchemaField> | null {
  if (!ft || typeof ft === "string") return null;
  const item = (ft as { array?: unknown }).array;
  return item ? objectShape(item as FieldType) : null;
}

/** Accept either the map form (sealed blob) or an array, always yield [key, value]. */
function entriesOf<T>(v: Record<string, T> | T[] | undefined): Array<[string, T]> {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((item, i) => [
      (item as { name?: string }).name ?? String(i),
      item,
    ]);
  }
  return Object.entries(v);
}

/**
 * Convert a PluginSchema to a json-render Spec using ONLY catalog components.
 * Catalog has: container, card, kv, heading, text, badge, row, code
 */
export function schemaToSpec(schema: PluginSchemaShape, pluginId: string): Spec {
  const elements: Record<string, unknown> = {};
  const rootChildren: string[] = [];

  const add = (key: string, element: unknown) => {
    elements[key] = element;
    return key;
  };

  // ── Header ───────────────────────────────────────────────────────────────
  const headerChildren: string[] = [];
  headerChildren.push(
    add("version", {
      type: "kv",
      props: { label: "Version", value: schema.version ?? "unknown", kind: "string" },
    }),
  );
  if (schema.category) {
    headerChildren.push(
      add("category", {
        type: "kv",
        props: { label: "Category", value: schema.category, kind: "string" },
      }),
    );
  }
  if (schema.description) {
    headerChildren.push(add("description", { type: "text", props: { text: schema.description } }));
  }
  rootChildren.push(
    add("header", {
      type: "card",
      props: { title: schema.display_name ?? schema.name ?? pluginId },
      children: headerChildren,
    }),
  );

  // ── Fields ───────────────────────────────────────────────────────────────
  // A field_type is either a primitive string ("integer") or a nested shape
  // ({object:{…}} / {array:…}). Typed plugins are mostly the latter, so render
  // the structure rather than stringifying it — `${ft}` on an object yields
  // "[object Object]", which is how this looked before procfs was typed.
  const fields = entriesOf<SchemaField>(schema.fields);
  if (fields.length > 0) {
    const fieldKeys: string[] = [];

    fields.forEach(([name, f], i) => {
      const label = f.required ? `${name} *` : name;
      const shape = objectShape(f.field_type);
      const rowShape = arrayRowShape(f.field_type);

      if (shape && Object.keys(shape).length > 0) {
        // Nested object: one row per subfield, so `loadavg` shows its floats.
        const kids = Object.entries(shape).map(([sub, sf], j) =>
          add(`field-${i}-${j}`, {
            type: "kv",
            props: { label: sub, value: typeLabel(sf?.field_type), kind: primitiveOf(sf?.field_type) },
          }),
        );
        fieldKeys.push(
          add(`field-${i}`, {
            type: "card",
            props: { title: `${label} · object` },
            children: kids,
          }),
        );
        return;
      }

      if (rowShape && Object.keys(rowShape).length > 0) {
        // Array of objects: show the row's columns, e.g. `mounts[]`.
        const kids = Object.entries(rowShape).map(([col, cf], j) =>
          add(`field-${i}-${j}`, {
            type: "kv",
            props: { label: col, value: typeLabel(cf?.field_type), kind: primitiveOf(cf?.field_type) },
          }),
        );
        fieldKeys.push(
          add(`field-${i}`, {
            type: "card",
            props: { title: `${label}[] · ${Object.keys(rowShape).length} columns` },
            children: kids,
          }),
        );
        return;
      }

      fieldKeys.push(
        add(`field-${i}`, {
          type: "kv",
          props: {
            label,
            value: f.read_only ? `${typeLabel(f.field_type)} (read-only)` : typeLabel(f.field_type),
            kind: primitiveOf(f.field_type),
          },
        }),
      );
    });

    rootChildren.push(
      add("fields", {
        type: "card",
        props: { title: `Fields (${fields.length})` },
        children: fieldKeys,
      }),
    );
  }

  // ── Methods ──────────────────────────────────────────────────────────────
  const methods = entriesOf<SchemaMethod>(schema.methods);
  if (methods.length > 0) {
    const methodKeys = methods.map(([name, m], i) => {
      const detail = [m.side_effect, m.idempotent ? "idempotent" : null, m.subid]
        .filter(Boolean)
        .join(" · ");
      return add(`method-${i}`, {
        type: "kv",
        props: { label: m.name ?? name, value: detail || "method", kind: "string" },
      });
    });
    rootChildren.push(
      add("methods", {
        type: "card",
        props: { title: `Methods (${methods.length})` },
        children: methodKeys,
      }),
    );
  }

  // ── Guarantees ───────────────────────────────────────────────────────────
  const guarantees = Object.entries(schema.guarantees ?? {});
  if (guarantees.length > 0) {
    const gKeys = guarantees.map(([name, on], i) =>
      add(`guarantee-${i}`, {
        type: "kv",
        props: { label: name.replace(/_/g, " "), value: on, kind: "boolean" },
      }),
    );
    rootChildren.push(
      add("guarantees", {
        type: "card",
        props: { title: "Guarantees" },
        children: gKeys,
      }),
    );
  }

  // ── Tags and dependencies ────────────────────────────────────────────────
  for (const [group, values, tone] of [
    ["tags", schema.tags ?? [], "info"],
    ["dependencies", schema.dependencies ?? [], "warn"],
  ] as const) {
    if (values.length === 0) continue;
    const badgeKeys = values.map((v, i) =>
      add(`${group}-${i}`, { type: "badge", props: { text: v, tone } }),
    );
    const rowKey = add(`${group}-row`, { type: "row", children: badgeKeys });
    rootChildren.push(
      add(group, {
        type: "card",
        props: { title: `${group[0].toUpperCase()}${group.slice(1)} (${values.length})` },
        children: [rowKey],
      }),
    );
  }

  elements["root"] = { type: "container", children: rootChildren };

  return { root: "root", elements } as Spec;
}
