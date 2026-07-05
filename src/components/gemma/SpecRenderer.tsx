/**
 * Thin wrapper around json-render's `<Renderer>` bound to our component catalog
 * (`jsonRenderRegistry`). json-render only renders element `type`s that exist in
 * the catalog, so we also supply a visible fallback for any stray unknown type
 * rather than letting it silently vanish.
 */
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { jsonRenderRegistry } from "@/lib/json-render-catalog";

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

export function SpecRenderer({ spec }: { spec: Spec | null }) {
  return (
    <Renderer
      spec={spec}
      registry={jsonRenderRegistry}
      fallback={UnknownComponent as never}
    />
  );
}
