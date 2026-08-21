import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Spec } from "@json-render/core";
import type { LegacyPageReference } from "@/json-render/navigation/reference-pages";

const mocks = vi.hoisted(() => ({
  generateSpecStream: vi.fn(),
}));

vi.mock("@/json-render/generate/spec-stream", () => ({
  generateSpecStream: mocks.generateSpecStream,
  isRenderableSpec: (value: Partial<Spec>) =>
    typeof value.root === "string" && Boolean(value.elements?.[value.root]),
}));

import { useGenerateSpec } from "@/json-render/generate/use-generate-spec";
import {
  clearReferencePageCache,
  useReferencePageSpec,
} from "@/json-render/generate/use-reference-page-spec";

const renderedSpec: Spec = {
  root: "root",
  elements: { root: { type: "container", props: {}, children: [] } },
};

beforeEach(() => {
  mocks.generateSpecStream.mockReset();
  mocks.generateSpecStream.mockImplementation(async (options) => {
    options.onSpec?.(renderedSpec);
    return renderedSpec;
  });
});

describe("standalone generation conversation isolation", () => {
  it("uses a fresh conversation for every Generate Studio request", async () => {
    const { result } = renderHook(() => useGenerateSpec());

    await act(async () => result.current.generatePrompt("First standalone result"));
    await act(async () => result.current.generatePrompt("Second standalone result"));

    const ids = mocks.generateSpecStream.mock.calls.map(([options]) => options.conversationId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("uses a fresh conversation when a reference page is regenerated", async () => {
    const reference: LegacyPageReference = {
      label: "Tools",
      route: "/test-fresh-reference-conversation",
      sourcePath: "src/pages/ToolsPage.tsx",
      source: "export default function ToolsPage() { return null; }",
    };
    clearReferencePageCache(reference.route);
    const { result, unmount } = renderHook(() => useReferencePageSpec(reference));

    await waitFor(() => expect(mocks.generateSpecStream).toHaveBeenCalledTimes(1));
    await act(async () => result.current.regenerate());

    const ids = mocks.generateSpecStream.mock.calls.map(([options]) => options.conversationId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);

    unmount();
    clearReferencePageCache(reference.route);
  });
});
