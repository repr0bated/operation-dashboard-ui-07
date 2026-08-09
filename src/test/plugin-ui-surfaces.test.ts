import { describe, expect, it } from "vitest";
import {
  antigravityUiSurfaceSpec,
  isRenderableGalleryPlugin,
  parsePluginUiSurfaces,
  pluginIdFromBlobRenderCatalogId,
  sealedPluginSpec,
} from "@/lib/plugin-ui-surfaces";
import cronSchema from "@/test/fixtures/plugin-schema-cron.json";

const antigravityEnvelope = {
  plugin: "antigravity",
  schema_hash: "abc123",
  schema: {
    name: "antigravity",
    display_name: "Antigravity SDK",
    fields: {
      auth: {
        field_type: { object: { method: { field_type: "string", default: "oauth_bridge" } } },
        default: { method: "oauth_bridge", provider: "google" },
      },
      safety_settings: {
        field_type: { array: { object: { category: { field_type: "string" } } } },
        default: [],
      },
      usage: {
        field_type: {
          object: {
            token_tracking: { field_type: { object: { total_input_tokens: { field_type: "integer" } } } },
          },
        },
        default: { token_tracking: { total_input_tokens: 0 } },
      },
      ui_surfaces: {
        default: [
          { name: "Antigravity SDK", path: "/antigravity", schema: "antigravity" },
          { name: "Authentication", path: "/antigravity/auth", schema: "antigravity.auth" },
        ],
      },
    },
    methods: {
      get_auth_status: { name: "get_auth_status", side_effect: "read", subid: "obs.auth" },
      get_usage_report: { name: "get_usage_report", side_effect: "read", subid: "obs.usage" },
      configure_safety: { name: "configure_safety", side_effect: "mutation", subid: "mut.safety" },
    },
  },
};

describe("sealed plugin UI surfaces", () => {
  it("reads Antigravity routes from fields.ui_surfaces.default", () => {
    const routes = parsePluginUiSurfaces({
      schema: antigravityEnvelope.schema,
    });

    expect(routes).toEqual([
      { name: "Antigravity SDK", path: "/antigravity", schema: "antigravity" },
      { name: "Authentication", path: "/antigravity/auth", schema: "antigravity.auth" },
    ]);
  });

  it("maps blob-render catalog ids to sealed plugin ids", () => {
    expect(pluginIdFromBlobRenderCatalogId("antigravity-blob-render")).toBe("antigravity");
    expect(pluginIdFromBlobRenderCatalogId("antigravity_chat-blob-render")).toBe("antigravity_chat");
    expect(pluginIdFromBlobRenderCatalogId("demo-widget")).toBeNull();
  });

  it("excludes backend-only plugins without UI surfaces from the gallery", () => {
    expect(isRenderableGalleryPlugin("antigravity")).toBe(true);
    expect(isRenderableGalleryPlugin("antigravity_chat")).toBe(false);
  });

  it("converts sealed plugin schema blobs into normalized json-render specs", () => {
    const spec = sealedPluginSpec("cron", {
      plugin: "cron",
      schema_hash: "abc123",
      schema: cronSchema,
    });

    expect(spec.root).toBe("root");
    expect(spec.elements.fields).toBeDefined();
  });

  it("renders an Antigravity ui_surface from sealed schema fields, not route metadata", () => {
    const authSurface = {
      name: "Authentication",
      path: "/antigravity/auth",
      schema: "antigravity.auth",
    };
    const spec = antigravityUiSurfaceSpec(antigravityEnvelope, authSurface);
    const serialized = JSON.stringify(spec.elements);

    expect(serialized).toContain("auth");
    expect(serialized).toContain("get_auth_status");
    expect(serialized).not.toContain('"path"');
    expect(serialized).not.toContain("Antigravity SDK {3}");
  });
});
