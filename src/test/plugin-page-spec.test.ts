import { describe, it, expect } from "vitest";
import { schemaToSpec } from "@/components/PluginPage";
import { jsonRenderRegistry } from "@/lib/json-render-catalog";
import cronSchema from "./fixtures/plugin-schema-cron.json";

/**
 * Fixture is a verbatim `/api/plugin-schema/cron` response, i.e. the sealed
 * blob's PluginSchema. The shape that matters: `fields` and `methods` are
 * maps keyed by name, NOT arrays.
 */
describe("schemaToSpec", () => {
  it("renders fields and methods from the map-shaped sealed schema", () => {
    const spec = schemaToSpec(cronSchema, "cron");
    const elements = spec.elements as Record<string, { type: string; props?: Record<string, unknown> }>;

    // The original bug: `.length` on a map is undefined, so both cards were
    // silently dropped while root still referenced them.
    expect(elements.fields).toBeDefined();
    expect(elements.methods).toBeDefined();
    expect(elements.fields.props?.title).toBe(`Fields (${Object.keys(cronSchema.fields).length})`);
    expect(elements.methods.props?.title).toBe(`Methods (${Object.keys(cronSchema.methods).length})`);

    // One element per field/method, carrying real schema values.
    const fieldNames = Object.keys(cronSchema.fields);
    fieldNames.forEach((_, i) => expect(elements[`field-${i}`]).toBeDefined());
    expect(elements["method-0"].props?.label).toBe(Object.keys(cronSchema.methods)[0]);
  });

  it("never references a child element that does not exist", () => {
    const spec = schemaToSpec(cronSchema, "cron");
    const elements = spec.elements as Record<string, { children?: string[] }>;

    expect(elements[spec.root]).toBeDefined();
    for (const [key, el] of Object.entries(elements)) {
      for (const child of el.children ?? []) {
        expect(elements[child], `${key} -> missing child ${child}`).toBeDefined();
      }
    }
  });

  it("only emits component types present in the catalog registry", () => {
    const spec = schemaToSpec(cronSchema, "cron");
    const catalog = new Set(Object.keys(jsonRenderRegistry));
    for (const el of Object.values(spec.elements as Record<string, { type: string }>)) {
      expect(catalog.has(el.type), `uncatalogued component: ${el.type}`).toBe(true);
    }
  });

  it("still handles an array-shaped schema", () => {
    const spec = schemaToSpec(
      {
        name: "legacy",
        fields: [{ field_type: "string", required: true }],
        methods: [{ name: "do_thing", side_effect: "mutation" }],
      },
      "legacy",
    );
    const elements = spec.elements as Record<string, { props?: Record<string, unknown> }>;
    expect(elements.fields).toBeDefined();
    expect(elements["method-0"].props?.label).toBe("do_thing");
  });
});
