import { describe, expect, it } from "vitest";
import rootSchema from "@/json-render/tched-router/tched-router-config.schema.json";
import {
  containsMasked,
  flattenLeaves,
  listSections,
  lookupSectionValue,
  MASKED_SECRET,
  normalize,
  parseConfigList,
  patchSectionKey,
  restoreMasked,
  sectionLabel,
  sectionSchema,
  type SchemaNode,
} from "@/json-render/tched-router/config-schema";

const fixture: SchemaNode = {
  title: "Config",
  type: "object",
  properties: {
    gateway: { $ref: "#/$defs/GatewayConfig", default: { port: 42617 } },
    locale: { type: ["string", "null"] },
    autonomy: {
      oneOf: [
        { const: "readonly", type: "string" },
        { const: "supervised", type: "string" },
        { const: "full", type: "string" },
      ],
    },
    token: { type: "string", "x-secret": true },
  },
  $defs: {
    GatewayConfig: {
      type: "object",
      description: "Gateway server configuration",
      properties: {
        port: { type: "integer", default: 42617, minimum: 0, maximum: 65535 },
        host: { type: "string", default: "127.0.0.1" },
        require_pairing: { type: "boolean", default: true },
        paired_tokens: { type: "array", items: { type: "string" }, "x-secret": true },
      },
    },
  },
};

describe("tched-router config schema adapter", () => {
  it("labels dotted section keys", () => {
    expect(sectionLabel("conversational_ai")).toBe("Conversational Ai");
    expect(sectionLabel("gateway")).toBe("Gateway");
  });

  it("resolves $ref sections into typed object schemas", () => {
    const schema = sectionSchema(fixture, "gateway");
    expect(schema.type).toBe("object");
    expect(schema.properties?.port).toMatchObject({ type: "integer", default: 42617 });
    expect(schema.properties?.require_pairing).toMatchObject({ type: "boolean" });
    expect(schema.properties?.paired_tokens).toMatchObject({ format: "password" });
  });

  it("unwraps null unions and flattens const oneOf to enums", () => {
    expect(normalize(fixture, fixture.properties!.locale as SchemaNode, new Set()).type).toBe(
      "string",
    );
    expect(normalize(fixture, fixture.properties!.autonomy as SchemaNode, new Set())).toMatchObject({
      type: "string",
      enum: ["readonly", "supervised", "full"],
    });
  });

  it("looks up values through serde aliases", () => {
    expect(lookupSectionValue({ channels_config: { cli: true } }, "channels")).toEqual({
      cli: true,
    });
    expect(patchSectionKey("channels")).toBe("channels_config");
    expect(patchSectionKey("gateway")).toBe("gateway");
  });

  it("restores unchanged masked secrets from the existing tree", () => {
    const incoming = { api_key: MASKED_SECRET, host: "127.0.0.1" };
    const existing = { api_key: "real-secret", host: "0.0.0.0" };
    expect(restoreMasked(incoming, existing)).toEqual({
      api_key: "real-secret",
      host: "127.0.0.1",
    });
    expect(containsMasked(incoming)).toBe(true);
    expect(containsMasked(restoreMasked(incoming, existing))).toBe(false);
  });

  it("parses zeroclaw config list text into nested values", () => {
    const parsed = parseConfigList(`
Legend: 🔒 secret

Gateway:
  gateway.port                                  = 42617                (u16)
  gateway.host                                  = 127.0.0.1            (String)
  gateway.require_pairing                       = true                 (bool)
  gateway.paired_tokens                         = <unset>              (Vec<String>) 🔒
  memory.backend                                = sqlite               (String)
`);
    expect(parsed).toEqual({
      gateway: {
        port: 42617,
        host: "127.0.0.1",
        require_pairing: true,
      },
      memory: { backend: "sqlite" },
    });
    expect(flattenLeaves(parsed.gateway, "gateway")).toEqual(
      expect.arrayContaining([
        { path: "gateway.port", value: 42617 },
        { path: "gateway.host", value: "127.0.0.1" },
      ]),
    );
    expect(
      flattenLeaves(
        [{ name: "compact", transport: "http", url: "http://127.0.0.1:8090" }],
        "mcp.servers",
      ),
    ).toEqual(
      expect.arrayContaining([
        { path: "mcp.servers.compact.transport", value: "http" },
        { path: "mcp.servers.compact.url", value: "http://127.0.0.1:8090" },
      ]),
    );
  });

  it("lifts dotted mcp.servers maps into named arrays", () => {
    const parsed = parseConfigList(`
Mcp:
  mcp.enabled                                   = true                 (bool)
  mcp.servers.compact.transport                 = http                 (McpTransport)
  mcp.servers.compact.url                       = http://127.0.0.1:8090 (Option<String>)
  mcp.servers.agents.transport                  = http                 (McpTransport)
  mcp.servers.agents.url                        = http://127.0.0.1:11437 (Option<String>)
`);
    expect(parsed.mcp).toMatchObject({
      enabled: true,
      servers: [
        { name: "compact", transport: "http", url: "http://127.0.0.1:8090" },
        { name: "agents", transport: "http", url: "http://127.0.0.1:11437" },
      ],
    });
  });

  it("lists every top-level section from the live zeroclaw schema", () => {
    const sections = listSections(rootSchema as SchemaNode);
    const keys = sections.map((section) => section.key);
    expect(keys).toEqual(expect.arrayContaining(["gateway", "memory", "security", "agents"]));
    expect(keys).not.toContain("mcp");
    expect(keys).not.toContain("mcp_bundles");
    expect(sections.length).toBeGreaterThan(70);
    const gateway = sections.find((section) => section.key === "gateway");
    expect(gateway?.schema.type).toBe("object");
    expect(gateway?.schema.properties?.port).toMatchObject({ type: "integer" });
  });
});
