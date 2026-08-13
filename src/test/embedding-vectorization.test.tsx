import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * Embedding Pipeline is zeroclaw's vectorization assignment surface.
 * The worker's reported model can lag; GetModelAssignments.vectorization is
 * the routing authority, applied via SetVectorizationModel.
 */

const callSubid = vi.fn();
const refresh = vi.fn();

vi.mock("@/grpc/client", () => ({
  embeddingService: {
    getWorkerStatus: vi.fn(() => new Promise(() => {})),
    getChannelDiagnostics: vi.fn(() => new Promise(() => {})),
    getQueue: vi.fn(() => new Promise(() => {})),
  },
  blockchainService: {
    getQdrantRoles: vi.fn(() => new Promise(() => {})),
  },
}));

vi.mock("@/hooks/use-zeroclaw-routing", () => ({
  useZeroclawRouting: () => ({
    snapshot: null,
    state: {
      selected_provider: "antigravity",
      selected_model: "gemini-2.5-flash",
      model_routes: [],
      providers: [],
      assignments: {
        vectorization: "voyage-3-large",
        qdrant_retrieval: null,
        cozo_retrieval: null,
        ovs_routing: null,
        obfuscation: null,
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

import EmbeddingPipelinePage from "@/pages/EmbeddingPipelinePage";
import { EMBEDDING_SUBIDS } from "@/lib/zeroclaw-routing";

describe("Embedding Pipeline is zeroclaw vectorization", () => {
  beforeEach(() => {
    callSubid.mockReset();
    callSubid.mockImplementation(async (subid: string) => {
      if (subid === EMBEDDING_SUBIDS.listModels) {
        return { models: ["voyage-3-large", "text-embedding-3-small"] };
      }
      return {};
    });
  });

  it("shows GetModelAssignments.vectorization even when the embedding worker is still loading", async () => {
    render(<EmbeddingPipelinePage />);

    await waitFor(() => {
      expect(screen.getAllByText("voyage-3-large").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/zeroclaw vectorization/i)).toBeInTheDocument();
    expect(screen.queryByText(/Axon\/Voyage/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(callSubid).toHaveBeenCalledWith(EMBEDDING_SUBIDS.listModels, {});
    });
  });
});
