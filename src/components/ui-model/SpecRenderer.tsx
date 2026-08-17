/**
 * Thin wrapper around json-render's `<Renderer>` bound to our component catalog
 * (`jsonRenderRegistry`). json-render only renders element `type`s that exist in
 * the catalog, so we also supply a visible fallback for any stray unknown type
 * rather than letting it silently vanish.
 */
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { registry as jsonRenderRegistry } from "@/json-render/catalog/registry";

const CATALOG = new Set(Object.keys(jsonRenderRegistry));

function UnknownComponent({ element }: { element?: { type?: string } }) {
  return (
    <div className="text-[11px] font-mono text-danger border border-danger/30 rounded px-2 py-1">
      unknown component: {element?.type ?? "?"}
    </div>
  );
}

/** True iff every element `type` in the spec is registered in the catalog. */
export function specUsesOnlyCatalog(spec: Spec | null | undefined): boolean {
  if (!spec || typeof spec !== "object") return false;
  const elements =
    (spec as { elements?: Record<string, { type?: string }> }).elements ?? {};
  return Object.values(elements).every((el) => !!el && CATALOG.has(el.type ?? ""));
}

type FlatElement = {
  type?: string;
  props?: Record<string, unknown> | null;
  children?: string[];
  bindings?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * @json-render/core resolveElementProps does `Object.entries(props)` with no
 * null guard. Specs that omit `props` (schemaToSpec containers/rows historically
 * did) crash ElementRenderer; the shell's contentRegion ElementErrorBoundary
 * then swallows the page — including every Gallery Antigravity card.
 */
function ensureElementProps(spec: Spec): Spec {
  const raw = (spec as { elements?: Record<string, FlatElement> }).elements;
  if (!raw) return spec;
  let changed = false;
  const elements: Record<string, FlatElement> = {};
  for (const [key, el] of Object.entries(raw)) {
    if (!el || typeof el !== "object") {
      elements[key] = el;
      continue;
    }
    if (el.props && typeof el.props === "object") {
      elements[key] = el;
      continue;
    }
    changed = true;
    elements[key] = { ...el, props: {} };
  }
  return changed ? ({ ...spec, elements } as Spec) : spec;
}

/**
 * Older gallery producers emit the original json-render tree format
 * (`{type, props, children}`) instead of the current `{root, elements}`
 * contract. Normalize it at the boundary so a valid sealed/catalogued spec
 * cannot disappear simply because its producer has not migrated yet.
 */
function normalizeLegacySpec(input: Spec | null): Spec | null {
  if (!input || typeof input !== "object") return null;
  if ("root" in input && "elements" in input) return ensureElementProps(input);
  const elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }> = {};
  let seq = 0;
  const visit = (node: unknown, label = "surface"): string => {
    const value = node && typeof node === "object" ? node as Record<string, unknown> : {};
    const rawType = typeof value.type === "string" ? value.type : "Unknown";
    const props = value.props && typeof value.props === "object" ? value.props as Record<string, unknown> : {};
    const children = Array.isArray(value.children) ? value.children.map((child) => visit(child)) : [];
    const id = `legacy-${seq++}`;
    let type = "text";
    let nextProps: Record<string, unknown> = { text: String(props.text ?? props.label ?? rawType) };
    if (rawType === "Page" || rawType === "Stack") {
      type = "container";
      nextProps = {};
    } else if (rawType === "Card" || rawType === "Table") {
      type = "card";
      nextProps = { title: String(props.title ?? label) };
    } else if (rawType === "Input" || rawType === "Checkbox") {
      type = "kv";
      const valueType = String(props.valueType ?? (rawType === "Checkbox" ? "boolean" : "string"));
      const liveValue = props.value ?? props.default;
      const displayValue =
        liveValue === "" || liveValue === null || liveValue === undefined
          ? `(${valueType})`
          : liveValue;
      nextProps = {
        label: String(props.label ?? props.name ?? label),
        value: displayValue,
        kind: rawType === "Checkbox" ? "boolean" : valueType,
      };
    } else if (rawType === "Button") {
      type = "badge";
      nextProps = { label: String(props.label ?? props.text ?? "Action"), tone: "default" };
    }
    elements[id] = { type, props: nextProps, ...(children.length ? { children } : {}) };
    return id;
  };
  return { root: visit(input), elements } as Spec;
}

export function SpecRenderer({ spec }: { spec: Spec | null }) {
  const normalized = normalizeLegacySpec(spec);
  return (
    <Renderer
      spec={normalized}
      registry={jsonRenderRegistry}
      fallback={UnknownComponent as never}
    />
  );
}
