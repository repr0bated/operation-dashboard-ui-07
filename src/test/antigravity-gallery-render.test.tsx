import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  antigravityUiSurfaceSpec,
  fetchAntigravityGalleryBundle,
  isAntigravityChatSurface,
  parsePluginUiSurfaces,
} from "@/lib/plugin-ui-surfaces";
import { SpecRenderer, specUsesOnlyCatalog } from "@/components/ui-model/SpecRenderer";
import { ShellRenderer } from "@/json-render/shell/ShellRenderer";
import { schemaToSpec } from "@/components/PluginPage";

/**
 * Minimal sealed envelope with ui_surfaces — enough to exercise the Gallery
 * antigravity path without checking in the ~93KB live blob.
 * Intentionally omits chat so fetchAntigravityGalleryBundle must inject it.
 */
const antigravityEnvelope = {
  plugin: "antigravity",
  schema_hash: "test",
  schema: {
    name: "antigravity",
    display_name: "Antigravity SDK",
    version: "1.0.0",
    category: "llm",
    description: "Antigravity SDK provider",
    tags: ["llm"],
    fields: {
      auth: {
        field_type: { object: { method: { field_type: "string" } } },
        default: { method: "oauth_bridge" },
      },
      safety_settings: {
        field_type: { array: { object: { category: { field_type: "string" } } } },
        default: [],
      },
      usage: {
        field_type: {
          object: {
            token_tracking: { field_type: { object: { total: { field_type: "integer" } } } },
          },
        },
        default: { token_tracking: { total: 0 } },
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

let errors: string[];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map(String).join(" "));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ui-model/plugin-schema/antigravity")) {
        return { ok: true, json: async () => antigravityEnvelope } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("antigravity gallery SpecRenderer", () => {
  const routes = parsePluginUiSurfaces(antigravityEnvelope);

  it("parses ui_surfaces from fields.ui_surfaces.default", () => {
    expect(routes).toHaveLength(2);
  });

  it("injects antigravity.chat surface when sealed blob omits it", async () => {
    const bundle = await fetchAntigravityGalleryBundle();
    const chat = bundle.surfaces.find((s) => isAntigravityChatSurface(s));
    expect(chat).toBeDefined();
    expect(chat!.id).toBe("antigravity/antigravity/chat");
    expect(chat!.path).toBe("/antigravity/chat");
    expect(chat!.schema).toBe("antigravity.chat");
    expect(JSON.stringify(chat!.spec)).toMatch(/ChatWidget/);
  });

  it("antigravity.chat fieldKeys=[] returns empty ChatWidget-oriented spec", () => {
    const surface = {
      name: "Antigravity Chat",
      path: "/antigravity/chat",
      schema: "antigravity.chat",
    };
    const spec = antigravityUiSurfaceSpec(antigravityEnvelope as never, surface);
    expect(specUsesOnlyCatalog(spec)).toBe(true);
    expect(JSON.stringify(spec)).toMatch(/ChatWidget/);
    expect(JSON.stringify(spec)).not.toMatch(/selected_provider|get_auth_status/);
  });

  it("auth surface mounts visible Fields/Methods inside the shell (no silent blank)", () => {
    const surface = routes.find((r) => r.schema === "antigravity.auth")!;
    const spec = antigravityUiSurfaceSpec(antigravityEnvelope as never, surface);
    expect(specUsesOnlyCatalog(spec)).toBe(true);

    render(
      <MemoryRouter initialEntries={["/gallery"]}>
        <ShellRenderer>
          <SpecRenderer spec={spec} />
        </ShellRenderer>
      </MemoryRouter>,
    );

    const real = errors.filter((e) => !e.includes("not wrapped in act"));
    expect(real, `console errors:\n${real.join("\n---\n")}`).toEqual([]);

    const main = within(document.querySelector("main") as HTMLElement);
    expect(main.getByText(/Fields \(/i)).toBeInTheDocument();
    expect(main.getByText(/Methods \(/i)).toBeInTheDocument();
    expect(main.getByText(/get_auth_status/i)).toBeInTheDocument();
  });

  it("SpecRenderer coerces missing props so a bad producer cannot blank contentRegion", () => {
    const broken = schemaToSpec(antigravityEnvelope.schema as never, "antigravity");
    // Simulate the historical bug: strip props from container/row.
    const elements = broken.elements as Record<string, { props?: unknown; type?: string }>;
    for (const el of Object.values(elements)) {
      if (el.type === "container" || el.type === "row") delete el.props;
    }

    render(
      <MemoryRouter initialEntries={["/gallery"]}>
        <ShellRenderer>
          <SpecRenderer spec={broken} />
        </ShellRenderer>
      </MemoryRouter>,
    );

    const real = errors.filter(
      (e) => !e.includes("not wrapped in act") && !e.includes("Cannot convert undefined"),
    );
    // Must not surface the Object.entries(props) crash that wiped Gallery.
    expect(errors.some((e) => e.includes("Cannot convert undefined or null to object"))).toBe(
      false,
    );
    expect(real, `console errors:\n${real.join("\n---\n")}`).toEqual([]);

    const main = within(document.querySelector("main") as HTMLElement);
    expect(main.getByText(/Fields \(/i)).toBeInTheDocument();
  });
});
