import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Per-surface zeroclaw assignments:
 *   Knowledge → qdrant_retrieval + cozo_retrieval
 *   Open vSwitch → ovs_routing + obfuscation
 *   LLM → the assignment board (not chat selected_model as "the" model)
 */

const callSubid = vi.fn();
const refresh = vi.fn();

vi.mock("@/hooks/use-zeroclaw-routing", () => ({
  useZeroclawRouting: () => ({
    snapshot: null,
    state: {
      selected_provider: "antigravity",
      selected_model: "gemini-2.5-flash",
      model_routes: [
        { id: "gemini-2.5-flash", name: "Gemini Flash" },
        { id: "gemini-retriever" },
        { id: "cozo-embed" },
        { id: "ovs-router" },
        { id: "obf-1" },
      ],
      providers: ["antigravity"],
      assignments: {
        vectorization: "voyage-3-large",
        qdrant_retrieval: "gemini-retriever",
        cozo_retrieval: "cozo-embed",
        ovs_routing: "ovs-router",
        obfuscation: "obf-1",
      },
    },
    loading: false,
    error: null,
    refresh,
  }),
}));

vi.mock("@/grpc/plugin-methods", () => ({
  pluginMethods: {
    callSubid: (subid: string, input?: object) => callSubid(subid, input),
  },
}));

import KnowledgePage from "@/pages/KnowledgePage";
import OpenSwitchPage from "@/pages/OpenSwitchPage";
import LlmPage from "@/pages/LlmPage";
import { EMBEDDING_SUBIDS } from "@/lib/zeroclaw-routing";

describe("Knowledge is zeroclaw retrieval assignments", () => {
  beforeEach(() => {
    callSubid.mockReset();
    callSubid.mockResolvedValue({ models: [] });
  });

  it("shows qdrant_retrieval and cozo_retrieval even when the event store is empty", async () => {
    render(<KnowledgePage />);

    await waitFor(() => {
      expect(screen.getAllByText("gemini-retriever").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/qdrant retrieval/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/cozo retrieval/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("cozo-embed").length).toBeGreaterThanOrEqual(1);
  });
});

describe("Open vSwitch is zeroclaw ovs_routing + obfuscation", () => {
  beforeEach(() => {
    callSubid.mockReset();
    callSubid.mockResolvedValue({ models: [] });
  });

  it("shows ovs_routing and obfuscation even when no bridges are present", async () => {
    render(<OpenSwitchPage />);

    await waitFor(() => {
      expect(screen.getAllByText("ovs-router").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/ovs routing/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/obfuscation/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("obf-1").length).toBeGreaterThanOrEqual(1);
  });
});

describe("LLM page is the assignment board", () => {
  beforeEach(() => {
    callSubid.mockReset();
    callSubid.mockImplementation(async (subid: string) => {
      if (subid === EMBEDDING_SUBIDS.listModels) return { models: ["voyage-3-large"] };
      return {};
    });
  });

  it("renders GetModelAssignments roles instead of treating selected_model as the active LLM", async () => {
    render(<LlmPage />);

    await waitFor(() => {
      expect(screen.getAllByText("voyage-3-large").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/model assignments/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Active Model")).not.toBeInTheDocument();
    expect(screen.getAllByText("gemini-retriever").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("cozo-embed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("ovs-router").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("obf-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/chat routing/i).length).toBeGreaterThanOrEqual(1);
  });
});
