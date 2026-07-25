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

import procfsSchema from "./fixtures/plugin-schema-procfs.json";

/**
 * procfs is the first plugin with genuinely nested field types. Before it was
 * typed, every field was the string "any"; now `loadavg` is {object:{…}} and
 * `mounts` is {array:{object:{…}}}. Interpolating those into a string yields
 * "[object Object]", so the renderer has to walk them.
 */
describe("schemaToSpec with nested field types", () => {
  it("renders a nested object field as a card of typed rows", () => {
    const spec = schemaToSpec(procfsSchema, "procfs");
    const els = spec.elements as Record<string, any>;
    const loadavg = Object.values(els).find(
      (e: any) => e.type === "card" && String(e.props?.title).startsWith("loadavg"),
    );
    expect(loadavg, "loadavg should render as its own card").toBeDefined();

    const rows = (loadavg as any).children.map((k: string) => els[k].props);
    const byLabel = Object.fromEntries(rows.map((r: any) => [r.label, r.value]));
    expect(byLabel.load1).toBe("float");
    expect(byLabel.procs_running).toBe("integer");
  });

  it("renders an array-of-objects field as its columns", () => {
    const spec = schemaToSpec(procfsSchema, "procfs");
    const els = spec.elements as Record<string, any>;
    const mounts = Object.values(els).find(
      (e: any) => e.type === "card" && String(e.props?.title).startsWith("mounts[]"),
    );
    expect(mounts, "mounts should render as a columns card").toBeDefined();

    const labels = (mounts as any).children.map((k: string) => els[k].props.label);
    expect(labels).toEqual(expect.arrayContaining(["device", "mountpoint", "fstype", "options"]));
  });

  it("never emits [object Object]", () => {
    const spec = schemaToSpec(procfsSchema, "procfs");
    const serialized = JSON.stringify(spec.elements);
    expect(serialized).not.toContain("[object Object]");
  });
});

import { callUnary } from "@/grpc/client";

describe("callUnary codec guard", () => {
  it("throws rather than silently sending an empty request", async () => {
    // encodeRequest falls back to an empty protobuf when no codec exists, which
    // would make a reflection-picked method look like it succeeded with {}.
    await expect(
      callUnary("some.unknown.Service", "NoSuchMethod", {}),
    ).rejects.toThrow(/No compiled protobuf codec/);
  });
});
