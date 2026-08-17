import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BlobsPage from "@/pages/BlobsPage";
import RoutableModelsPage from "@/pages/RoutableModelsPage";

/**
 * Regression tests for two reported defects:
 *
 *  1. The Sealed Blobs page omitted plugins that have no generated gRPC method
 *     clients (antigravity, antigravity_chat) because it enumerated the
 *     build-time codegen index instead of the sealed blob catalog.
 *  2. Routable Models rendered a hardcoded MOCK_AGENTS array containing
 *     "gpt-4o", which had no relationship to the running gateway.
 */

/** The live catalog shape, trimmed. Includes plugins absent from codegen. */
const CATALOG = {
  plugins: [
    "adc",
    "antigravity",
    "antigravity_chat",
    "cron",
    "gemma_brain",
    "json_render",
    "large_language_model",
    "procfs",
    "tched_router",
  ],
};

const PROVIDERS = { providers: ["antigravity", "salad"], current: "antigravity" };
const STATUS = {
  provider: "antigravity",
  model: "gemini-2.5-flash",
  model_non_sandboxed: false,
  available: true,
};
/** The real 503 body from /api/llm/models when the projection is down. */
const MODELS_503 = {
  error: "tched_router model route projection is unavailable",
  provider: "tched_router",
  models: [],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function routeFetch(handler: (path: string) => Response) {
  fetchMock.mockImplementation((url: string) => Promise.resolve(handler(String(url))));
}

describe("Sealed Blobs reads the blob catalog, not the codegen index", () => {
  it("lists plugins that have no generated gRPC clients (the antigravity bug)", async () => {
    routeFetch((url) => {
      if (url.includes("/ui-model/plugins")) return jsonResponse(CATALOG);
      if (url.includes("/ui-model/plugin-schema/")) {
        return jsonResponse({ plugin: "antigravity_chat", schema: { name: "x" } });
      }
      return jsonResponse({}, 404);
    });

    render(
      <MemoryRouter>
        <BlobsPage />
      </MemoryRouter>,
    );

    // antigravity has zero entries in PLUGIN_METHOD_BY_PLUGIN, so it was
    // previously invisible. Exact text match: "antigravity_chat" must not
    // satisfy the assertion for "antigravity".
    await waitFor(() => {
      expect(screen.getByText("antigravity")).toBeInTheDocument();
    });
    expect(screen.getByText("antigravity_chat")).toBeInTheDocument();
    // Both live in the sidebar list, not the detail pane.
    const aside = within(document.querySelector("aside") as HTMLElement);
    expect(aside.getByText("antigravity")).toBeInTheDocument();
    expect(aside.getByText("antigravity_chat")).toBeInTheDocument();

    // It queried the catalog endpoint, i.e. the sealed-blob SSOT.
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes("/ui-model/plugins")),
    ).toBe(true);

    // Count reflects the catalog, not the 54-plugin codegen index.
    expect(screen.getByText(new RegExp(`${CATALOG.plugins.length} sealed plugins`)))
      .toBeInTheDocument();
  });

  it("surfaces a catalog failure instead of rendering an empty list silently", async () => {
    routeFetch(() => jsonResponse({}, 503));

    render(
      <MemoryRouter>
        <BlobsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sealed blob catalog unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText(/catalog HTTP 503/)).toBeInTheDocument();
  });
});

describe("Routable Models shows live gateway state, never mock models", () => {
  it("renders the live provider and model, with no hardcoded gpt-4o", async () => {
    routeFetch((url) => {
      if (url.includes("/llm/status")) return jsonResponse(STATUS);
      if (url.includes("/llm/providers")) return jsonResponse(PROVIDERS);
      if (url.includes("/llm/models")) return jsonResponse(MODELS_503, 503);
      return jsonResponse({}, 404);
    });

    render(
      <MemoryRouter>
        <RoutableModelsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument();
    });

    // Live providers are listed, current one marked active.
    expect(screen.getByText("salad")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();

    // The mock data is gone.
    expect(screen.queryByText(/gpt-4o/)).not.toBeInTheDocument();
    expect(screen.queryByText("Main Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Security Scanner")).not.toBeInTheDocument();
  });

  it("reports the model projection outage rather than inventing models", async () => {
    routeFetch((url) => {
      if (url.includes("/llm/status")) return jsonResponse(STATUS);
      if (url.includes("/llm/providers")) return jsonResponse(PROVIDERS);
      if (url.includes("/llm/models")) return jsonResponse(MODELS_503, 503);
      return jsonResponse({}, 404);
    });

    render(
      <MemoryRouter>
        <RoutableModelsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Model list unavailable")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/tched_router model route projection is unavailable/),
    ).toBeInTheDocument();
  });

  it("renders real models when the projection is healthy", async () => {
    const models = {
      provider: "tched_router",
      models: [
        { id: "qwen3.6-35b-a3b", name: "Qwen 3.6", parameters: "35B", available: true, tags: ["salad"] },
        { id: "gemini-2.5-flash", name: "Gemini Flash", available: true, tags: [] },
      ],
    };
    routeFetch((url) => {
      if (url.includes("/llm/status")) return jsonResponse(STATUS);
      if (url.includes("/llm/providers")) return jsonResponse(PROVIDERS);
      if (url.includes("/llm/models")) return jsonResponse(models);
      return jsonResponse({}, 404);
    });

    render(
      <MemoryRouter>
        <RoutableModelsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector("table")).not.toBeNull();
    });
    const table = within(document.querySelector("table") as HTMLElement);
    expect(table.getByText("qwen3.6-35b-a3b")).toBeInTheDocument();
    expect(table.getByText("Qwen 3.6")).toBeInTheDocument();
    expect(table.getByText("35B")).toBeInTheDocument();
    expect(screen.queryByText("Model list unavailable")).not.toBeInTheDocument();
  });

  it("surfaces a gateway failure as a fatal banner", async () => {
    routeFetch(() => jsonResponse({}, 500));

    render(
      <MemoryRouter>
        <RoutableModelsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("LLM gateway unavailable")).toBeInTheDocument();
    });
  });
});
