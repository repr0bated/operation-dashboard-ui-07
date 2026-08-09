import { describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import { registry as jsonRenderRegistry } from "@/json-render/catalog/registry";

/**
 * Mirror the legacy-tree normalizer from SpecRenderer so gallery catalog
 * entries shaped like `/dev/shm/ui-specs.json` render visible field rows.
 */
function normalizeLegacySpec(input: Spec | null): Spec | null {
  if (!input || typeof input !== "object") return null;
  if ("root" in input && "elements" in input) return input;
  const elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }> = {};
  let seq = 0;
  const visit = (node: unknown, label = "surface"): string => {
    const value = node && typeof node === "object" ? (node as Record<string, unknown>) : {};
    const rawType = typeof value.type === "string" ? value.type : "Unknown";
    const props = value.props && typeof value.props === "object" ? (value.props as Record<string, unknown>) : {};
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

describe("legacy gallery spec normalization", () => {
  it("shows field types instead of blank values for schema-only Input nodes", () => {
    const normalized = normalizeLegacySpec({
      type: "Page",
      props: { title: "antigravity (sealed blob)" },
      children: [
        {
          type: "Stack",
          children: [
            {
              type: "Card",
              props: { title: "auth" },
              children: [
                {
                  type: "Input",
                  props: {
                    name: "auth.method",
                    label: "method",
                    valueType: "string",
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as Spec);

    const values = Object.values(normalized!.elements).map((element) => element.props?.value);
    expect(values).toContain("(string)");
    expect(values).not.toContain("");
  });

  it("only emits catalog component types", () => {
    const normalized = normalizeLegacySpec({
      type: "Page",
      props: { title: "demo" },
      children: [{ type: "Input", props: { label: "x", valueType: "string" } }],
    } as unknown as Spec);
    const catalog = new Set(Object.keys(jsonRenderRegistry));
    for (const element of Object.values(normalized!.elements)) {
      expect(catalog.has(element.type)).toBe(true);
    }
  });
});
