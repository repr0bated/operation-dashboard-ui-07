import { describe, it, expect } from "vitest";
import { schemaToSpec } from "@/components/PluginPage";
import { registry as jsonRenderRegistry } from "@/json-render/catalog/registry";
import pluginSchema from "./fixtures/plugin-schema-zeroclaw.json";
import schemarsSchema from "./fixtures/zeroclaw-config-schema.json";
import {
  ROUTING_FIELDS,
  chatSendRouting,
  jsonSchemaHasRouting,
  loadZeroclawRouting,
  pluginSchemaHasRouting,
  pluginSchemaToJsonSchema,
  populateRoutingSchema,
  resolveSchemarsRoot,
  routingFromState,
  routingJsonSchema,
  schemaPropagatesRouting,
  ZEROCLAW_SUBIDS,
} from "@/lib/zeroclaw-routing";
import type { JsonSchema } from "@/types/api";

/**
 * OD-28: zeroclaw owns selected_provider / selected_model / model_routes.
 * Those fields must survive schemars → PluginSchema / JSON Schema, and the
 * UI must populate them from live GetState / GetRouter / GetModelRoutes.
 */

describe("zeroclaw schemars routing contract", () => {
  it("sealed PluginSchema carries selected_provider, selected_model, and model_routes", () => {
    expect(pluginSchemaHasRouting(pluginSchema)).toBe(true);
    expect(schemaPropagatesRouting(pluginSchema)).toBe(true);
    for (const field of ROUTING_FIELDS) {
      expect(pluginSchema.fields).toHaveProperty(field);
    }
  });

  it("schemars GetConfigSchema dump carries routing properties (including $ref/$defs form)", () => {
    expect(jsonSchemaHasRouting(schemarsSchema as JsonSchema)).toBe(true);
    expect(schemaPropagatesRouting(schemarsSchema)).toBe(true);

    const root = resolveSchemarsRoot(schemarsSchema as JsonSchema);
    expect(root.properties).toHaveProperty("selected_provider");
    expect(root.properties).toHaveProperty("selected_model");
    expect(root.properties).toHaveProperty("model_routes");
    expect(root.properties?.selected_provider?.description).toMatch(/routing authority/i);
  });

  it("set_provider / set_model method returns are schemars schemas naming selected_* fields", () => {
    const setProvider = pluginSchema.methods.set_provider.returns;
    const setModel = pluginSchema.methods.set_model.returns;
    expect(setProvider.properties).toHaveProperty("selected_provider");
    expect(setModel.properties).toHaveProperty("selected_model");
    expect(schemaPropagatesRouting(pluginSchema.methods)).toBe(true);
  });
});

describe("pluginSchemaToJsonSchema", () => {
  it("turns sealed PluginSchema fields into a SchemaRenderer-ready JSON Schema", () => {
    const json = pluginSchemaToJsonSchema(pluginSchema);
    expect(json.type).toBe("object");
    expect(json.properties).toHaveProperty("selected_provider");
    expect(json.properties?.selected_provider?.type).toBe("string");
    expect(json.properties?.model_routes?.type).toBe("array");
    expect(json.properties?.model_routes?.items).toMatchObject({ type: "object" });
    expect(
      (json.properties?.model_routes?.items as JsonSchema).properties,
    ).toHaveProperty("id");
  });

  it("routingJsonSchema accepts either a schemars dump or a PluginSchema", () => {
    const fromPlugin = routingJsonSchema(pluginSchema);
    const fromSchemars = routingJsonSchema(schemarsSchema);
    expect(jsonSchemaHasRouting(fromPlugin)).toBe(true);
    expect(jsonSchemaHasRouting(fromSchemars)).toBe(true);
    expect(fromSchemars.properties).toHaveProperty("selected_provider");
  });
});

describe("routingFromState + populateRoutingSchema", () => {
  const live = {
    selected_provider: "antigravity",
    selected_model: "gemini-2.5-flash",
    model_routes: [
      { id: "gemini-2.5-flash", name: "Gemini Flash", provider: "antigravity", available: true },
      { id: "qwen3.6-35b-a3b", name: "Qwen 3.6", provider: "salad", available: true },
    ],
    providers: ["antigravity", "salad"],
  };

  it("reads snake_case, camelCase, and nested router snapshots", () => {
    expect(
      routingFromState({
        selected_provider: "antigravity",
        selected_model: "gemini-2.5-flash",
      }),
    ).toMatchObject({
      selected_provider: "antigravity",
      selected_model: "gemini-2.5-flash",
    });

    expect(
      routingFromState({
        selectedProvider: "salad",
        selectedModel: "qwen3.6-35b-a3b",
      }),
    ).toMatchObject({
      selected_provider: "salad",
      selected_model: "qwen3.6-35b-a3b",
    });

    expect(
      routingFromState(
        {},
        {
          router: { provider: "antigravity", model: "gemini-2.5-flash" },
          providers: [{ id: "antigravity" }, { name: "salad" }],
          modelRoutes: [{ id: "gemini-2.5-flash" }],
        },
      ),
    ).toMatchObject({
      selected_provider: "antigravity",
      selected_model: "gemini-2.5-flash",
      providers: ["antigravity", "salad"],
    });
  });

  it("injects live provider/model ids as enums on the schemars schema", () => {
    const schema = routingJsonSchema(schemarsSchema);
    const populated = populateRoutingSchema(schema, live);
    expect(populated.properties?.selected_provider?.enum).toEqual(["antigravity", "salad"]);
    expect(populated.properties?.selected_model?.enum).toEqual([
      "gemini-2.5-flash",
      "qwen3.6-35b-a3b",
    ]);
  });

  it("maps routing state onto Chat SendRequest provider/model (OD-28)", () => {
    expect(chatSendRouting(live)).toEqual({
      provider: "antigravity",
      model: "gemini-2.5-flash",
    });
    expect(chatSendRouting({ selected_provider: null, selected_model: null, model_routes: [], providers: [] }))
      .toEqual({ provider: "", model: "" });
  });
});

describe("loadZeroclawRouting", () => {
  it("composes GetConfigSchema + GetState + GetModelRoutes + ListProviders", async () => {
    const calls: string[] = [];
    const snap = await loadZeroclawRouting(async (subid) => {
      calls.push(subid);
      switch (subid) {
        case ZEROCLAW_SUBIDS.configSchema:
          return { configSchema: schemarsSchema };
        case ZEROCLAW_SUBIDS.state:
          return {
            state: {
              selected_provider: "antigravity",
              selected_model: "gemini-2.5-flash",
            },
          };
        case ZEROCLAW_SUBIDS.modelRoutes:
          return {
            modelRoutes: [
              { id: "gemini-2.5-flash", name: "Gemini Flash", available: true },
              { id: "qwen3.6-35b-a3b", name: "Qwen 3.6", available: true },
            ],
          };
        case ZEROCLAW_SUBIDS.providers:
          return {
            providers: [{ id: "antigravity" }, { id: "salad", kind: "remote" }],
          };
        case ZEROCLAW_SUBIDS.router:
          return { router: { provider: "antigravity", model: "gemini-2.5-flash" } };
        default:
          throw new Error(`unexpected subid ${subid}`);
      }
    });

    expect(calls).toEqual(expect.arrayContaining([
      ZEROCLAW_SUBIDS.configSchema,
      ZEROCLAW_SUBIDS.state,
      ZEROCLAW_SUBIDS.modelRoutes,
      ZEROCLAW_SUBIDS.providers,
    ]));
    expect(jsonSchemaHasRouting(snap.schema)).toBe(true);
    expect(snap.state.selected_provider).toBe("antigravity");
    expect(snap.state.selected_model).toBe("gemini-2.5-flash");
    expect(snap.state.providers).toEqual(["antigravity", "salad"]);
    expect(snap.state.model_routes.map((m) => m.id)).toEqual([
      "gemini-2.5-flash",
      "qwen3.6-35b-a3b",
    ]);
    expect(snap.populatedSchema.properties?.selected_model?.enum).toContain("gemini-2.5-flash");
    expect(chatSendRouting(snap.state)).toEqual({
      provider: "antigravity",
      model: "gemini-2.5-flash",
    });
  });

  it("falls back to PluginSchema when GetConfigSchema is missing", async () => {
    const snap = await loadZeroclawRouting(async (subid) => {
      if (subid === ZEROCLAW_SUBIDS.configSchema) throw new Error("no schema rpc");
      if (subid === ZEROCLAW_SUBIDS.state) {
        return { state: { selected_provider: "salad", selected_model: "qwen3.6-35b-a3b" } };
      }
      if (subid === ZEROCLAW_SUBIDS.modelRoutes) return { modelRoutes: [] };
      if (subid === ZEROCLAW_SUBIDS.providers) return { providers: [{ id: "salad" }] };
      return {};
    }, { pluginSchema });

    expect(jsonSchemaHasRouting(snap.schema)).toBe(true);
    expect(snap.state.selected_provider).toBe("salad");
    expect(snap.state.selected_model).toBe("qwen3.6-35b-a3b");
  });
});

describe("schemaToSpec surfaces zeroclaw routing fields", () => {
  it("renders selected_provider, selected_model, and model_routes from the sealed schema", () => {
    const spec = schemaToSpec(pluginSchema, "zeroclaw");
    const els = spec.elements as Record<string, { type: string; props?: Record<string, unknown> }>;
    const labels = Object.values(els).map((e) => e.props?.label);
    const titles = Object.values(els).map((e) => e.props?.title);

    expect(labels).toEqual(expect.arrayContaining(["selected_provider", "selected_model"]));
    expect(titles.some((t) => String(t).startsWith("model_routes"))).toBe(true);

    const catalog = new Set(Object.keys(jsonRenderRegistry));
    for (const el of Object.values(els)) {
      expect(catalog.has(el.type)).toBe(true);
    }
  });
});
