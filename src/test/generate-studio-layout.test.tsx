import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/json-render/generate/use-tile-object", () => ({
  useTileObject: () => ({
    prompt: "Make this dataset accessible",
    setPrompt: vi.fn(),
    raw: '{"op":"add","path":"/root","value":"result"}',
    spec: {
      root: "result",
      elements: { result: { type: "container", props: {}, children: [] } },
    },
    error: null,
    sending: false,
    generate: vi.fn(),
  }),
}));

vi.mock("@/json-render/catalog/registry-holder", () => ({
  tryGetAppRegistry: () => ({}),
}));

vi.mock("@/json-render/runtime/GeneratedSpecRenderer", () => ({
  GeneratedSpecRenderer: () => <div>Rendered generated interface</div>,
}));

import { GenerateStudioEl } from "@/json-render/catalog/components/generate-studio";

describe("Generate Studio layout", () => {
  it("places the full-width generated result before bounded SpecStream diagnostics", () => {
    const Component = GenerateStudioEl as React.ComponentType<{ props: { className: null } }>;
    render(<Component props={{ className: null }} />);

    const result = screen.getByTestId("generated-result-panel");
    const diagnostics = screen.getByTestId("specstream-diagnostics-panel");

    expect(result).toHaveClass("w-full");
    expect(result).not.toHaveClass("min-h-[20rem]");
    expect(result).toHaveTextContent("Rendered generated interface");
    expect(diagnostics).toHaveClass("w-full", "max-h-[18rem]", "overflow-auto");
    expect(diagnostics).toHaveTextContent("Supporting tile JSON");
    expect(result.compareDocumentPosition(diagnostics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
