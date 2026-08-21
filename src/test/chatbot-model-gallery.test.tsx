import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  fetchChatbotModelGalleryBundle,
  parsePluginUiSurfaces,
  resolveChatSelection,
  routerUiSurfaceSpec,
} from "@/lib/plugin-ui-surfaces";
import { SpecRenderer, specUsesOnlyCatalog } from "@/components/ui-model/SpecRenderer";
import { ShellRenderer } from "@/json-render/shell/ShellRenderer";
import { pluginMethods } from "@/grpc/plugin-methods";

vi.mock("@/grpc/plugin-methods", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/grpc/plugin-methods")>();
  return {
    ...actual,
    pluginMethods: {
      ...actual.pluginMethods,
      callSubid: vi.fn(async () => ({})),
    },
  };
});

const callSubid = pluginMethods.callSubid as unknown as ReturnType<typeof vi.fn>;

const routerEnvelope = {
  plugin: "tched_router",
  schema_hash: "abc123def456",
  schema: {
    name: "tched_router",
    display_name: "3tched Router",
    version: "1.0.0",
    description: "Chatbot model router",
    fields: {
      selected_provider: { field_type: "string", default: "opencode" },
      selected_model: { field_type: "string", default: "deepseek-v4-flash-free" },
      providers: { field_type: "array", default: [] },
      model_routes: { field_type: "array", default: [] },
      actor_id: { field_type: "string" },
      ui_surfaces: {
        default: [
          // Stale sealed blob may still advertise /chat — UI must drop it.
          { name: "Antigravity Chat", path: "/chat", schema: "tched_router" },
          { name: "Routable Models", path: "/models", schema: "tched_router.providers" },
          { name: "gRPC Diagnostics", path: "/grpc", schema: "plugin-service" },
        ],
      },
    },
    methods: {
      GetModelRoutes: { name: "GetModelRoutes", side_effect: "read", subid: "obs.x" },
      SetProvider: { name: "SetProvider", side_effect: "mutation", subid: "mut.x" },
      Chat: { name: "Chat", side_effect: "mutation", subid: "mut.chat" },
    },
  },
};

let errors: string[];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map(String).join(" "));
  });
  // Live routing comes from tched_router GetRouter over the gRPC bridge.
  callSubid.mockReset();
  callSubid.mockImplementation(async (subid: string) => {
    if (subid === "obs.service.tched-router.router.get@v1") {
      return {
        router: { provider: "opencode", model: "deepseek-v4-flash-free", available: true },
      };
    }
    return {};
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ui-model/plugin-schema/tched_router")) {
        return { ok: true, json: async () => routerEnvelope } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("chatbot model gallery (tched_router)", () => {
  it("loads tched_router model surfaces and filters stale /chat ownership", async () => {
    const bundle = await fetchChatbotModelGalleryBundle();
    expect(bundle.provider).toBe("opencode");
    expect(bundle.model).toBe("deepseek-v4-flash-free");
    expect(bundle.surfaces.map((s) => s.id)).toEqual(["tched_router/models", "tched_router/grpc"]);
    expect(bundle.surfaces.some((s) => s.path === "/chat" || s.id === "tched_router/chat")).toBe(
      false,
    );
    for (const surface of bundle.surfaces) {
      expect(specUsesOnlyCatalog(surface.spec)).toBe(true);
    }
  });

  it("resolveChatSelection reads tched_router GetRouter (not Gemini)", async () => {
    const route = await resolveChatSelection();
    expect(route.provider).toBe("opencode");
    expect(route.model).toBe("deepseek-v4-flash-free");
  });

  it("providers surface keeps routing fields and drops unrelated actor_id", () => {
    const surface = parsePluginUiSurfaces(routerEnvelope).find(
      (r) => r.schema === "tched_router.providers",
    )!;
    const spec = routerUiSurfaceSpec(routerEnvelope as never, surface);
    const labels = Object.values(
      spec.elements as Record<string, { props?: Record<string, unknown> }>,
    )
      .map((el) => el.props?.label)
      .filter(Boolean);
    expect(labels).toContain("selected_provider");
    expect(labels).toContain("selected_model");
    expect(labels).not.toContain("actor_id");
  });

  it("unknown schema falls back to full schema with surface display_name", () => {
    const surface = parsePluginUiSurfaces(routerEnvelope).find(
      (r) => r.schema === "plugin-service",
    )!;
    const spec = routerUiSurfaceSpec(routerEnvelope as never, surface);
    const root = Object.values(spec.elements as Record<string, { props?: Record<string, unknown> }>).find(
      (el) => el.props?.title === "gRPC Diagnostics" || el.props?.label === "gRPC Diagnostics",
    );
    // display_name flows into the generated title/header somewhere in the spec tree
    const dump = JSON.stringify(spec);
    expect(dump).toContain("gRPC Diagnostics");
    expect(root || dump.includes("selected_provider")).toBeTruthy();
  });

  it("main tched_router schema (null fieldKeys) mounts Fields inside the shell", () => {
    const surface = { name: "3tched Router", path: "/tched_router", schema: "tched_router" };
    const spec = routerUiSurfaceSpec(routerEnvelope as never, surface);

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
    expect(main.getByText(/selected_provider/i)).toBeInTheDocument();
  });
});
