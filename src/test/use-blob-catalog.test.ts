import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBlobCatalog, mergeBlobCatalogPluginIds } from "@/hooks/use-blob-catalog";
import { useEventStore } from "@/stores/event-store";

vi.mock("@/stores/event-store", () => ({
  useEventStore: vi.fn(),
}));

describe("useBlobCatalog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  describe("mergeBlobCatalogPluginIds", () => {
    it("merges and sorts distinct IDs from manifest and stream", () => {
      expect(mergeBlobCatalogPluginIds(["b", "a"], ["c", "b"])).toEqual(["a", "b", "c"]);
    });
  });

  it("fetches the catalog manifest and merges it with streamed schemas", async () => {
    const mockStore = (selector: (state: any) => any) => {
      const state = {
        schemas: { livePlugin: {} },
        catalogHash: "abc",
      };
      return selector(state);
    };
    vi.mocked(useEventStore).mockImplementation(mockStore);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ plugins: ["staticPlugin", "livePlugin"] }),
    } as Response);

    const { result } = renderHook(() => useBlobCatalog());

    expect(result.current.loading).toBe(true);
    expect(result.current.live).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.plugins).toEqual(["livePlugin", "staticPlugin"]);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch errors gracefully", async () => {
    const mockStore = (selector: (state: any) => any) => {
      const state = { schemas: {}, catalogHash: "abc" };
      return selector(state);
    };
    vi.mocked(useEventStore).mockImplementation(mockStore);

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network failure"));

    const { result } = renderHook(() => useBlobCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("network failure");
    expect(result.current.plugins).toEqual([]);
  });

  it("fails if response is not JSON (e.g. falls through to SPA index)", async () => {
    const mockStore = (selector: (state: any) => any) => {
      const state = { schemas: {}, catalogHash: "abc" };
      return selector(state);
    };
    vi.mocked(useEventStore).mockImplementation(mockStore);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useBlobCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain("not JSON");
  });
});
