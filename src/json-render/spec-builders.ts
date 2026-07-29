/**
 * Spec builders: turn arbitrary runtime JSON into a catalog-valid spec.
 *
 * Pure functions — no React, no registry import — so they are safe to use from
 * anywhere (including tests) without pulling in the component tree.
 *
 * Both builders emit only `container` / `card` / `kv` element types, all of
 * which are declared in the catalog.
 */
import type { Spec, UIElement } from "@json-render/core";

type ElementMap = Record<string, UIElement>;

function add(
  elements: ElementMap,
  prefix: string,
  type: string,
  props: Record<string, unknown>,
  children?: string[],
): string {
  elements[prefix] = {
    type,
    props,
    ...(children && children.length ? { children } : {}),
  } as UIElement;
  return prefix;
}

function walk(
  elements: ElementMap,
  data: unknown,
  path: string,
  label?: string,
): string {
  // Primitive leaves → kv
  if (data === null || data === undefined) {
    return add(elements, path, "kv", {
      label: label ?? "value",
      value: null,
      kind: "null",
    });
  }
  const t = typeof data;
  if (t === "string" || t === "number" || t === "boolean") {
    return add(elements, path, "kv", { label: label ?? "value", value: data, kind: t });
  }

  if (Array.isArray(data)) {
    const childKeys = data.map((v, i) => walk(elements, v, `${path}.${i}`, String(i)));
    return add(
      elements,
      path,
      "card",
      { title: `${label ?? "list"} [${data.length}]` },
      childKeys,
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);
  const childKeys = entries.map(([k, v]) => walk(elements, v, `${path}.${k}`, k));
  return add(
    elements,
    path,
    "card",
    { title: `${label ?? "object"} {${entries.length}}` },
    childKeys,
  );
}

/** Convert any JSON value into a spec for `<Renderer>`. */
export function dataToSpec(data: unknown, rootLabel = "root"): Spec {
  const elements: ElementMap = {};
  const rootKey = walk(elements, data, "$", rootLabel);
  return { root: rootKey, elements };
}

/**
 * Convert a list of streamed messages into a spec.
 * Each message renders as a card prefixed with its sequence number.
 */
export function streamToSpec(messages: unknown[], title = "stream"): Spec {
  const elements: ElementMap = {};
  const childKeys: string[] = [];
  messages.forEach((msg, i) => {
    childKeys.push(walk(elements, msg, `$.${i}`, `#${i + 1}`));
  });
  const root = "$";
  elements[root] = {
    type: "card",
    props: { title: `${title} · ${messages.length} msgs` },
    children: childKeys,
  } as UIElement;
  return { root, elements };
}
