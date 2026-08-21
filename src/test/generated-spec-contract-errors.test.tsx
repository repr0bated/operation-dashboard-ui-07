import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import { registry } from "@/json-render/catalog/registry";
import { GeneratedSpecRenderer } from "@/json-render/runtime/GeneratedSpecRenderer";
import { specGenerationSystemPrompt } from "@/json-render/generate/spec-stream";

describe("generated spec component contracts", () => {
  it("surfaces the splitPane children contract error instead of a blank result", () => {
    const spec = {
      root: "workspace-split",
      elements: {
        "workspace-split": {
          type: "splitPane",
          props: { direction: "horizontal", className: null },
          children: ["usage-card", "chat-pane"],
        },
        "usage-card": {
          type: "cardEl",
          props: { title: "Usage & authentication", subtitle: null, className: null },
          children: [],
        },
        "chat-pane": {
          type: "cardEl",
          props: { title: "Antigravity live chat", subtitle: null, className: null },
          children: [],
        },
      },
    } as Spec;

    render(<GeneratedSpecRenderer spec={spec} registry={registry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("splitPane contract error");
    expect(screen.getByRole("alert")).toHaveTextContent("Use a grid or container");
  });

  it("renders the same generated sections when the model uses the supported grid contract", () => {
    const spec = {
      root: "workspace-grid",
      elements: {
        "workspace-grid": {
          type: "grid",
          props: { cols: 2, gap: 16, className: null },
          children: ["usage-card", "chat-pane"],
        },
        "usage-card": {
          type: "cardEl",
          props: { title: "Usage & authentication", subtitle: null, className: null },
          children: [],
        },
        "chat-pane": {
          type: "cardEl",
          props: { title: "Antigravity live chat", subtitle: null, className: null },
          children: [],
        },
      },
    } as Spec;

    render(<GeneratedSpecRenderer spec={spec} registry={registry} />);

    expect(screen.getByText("Usage & authentication")).toBeInTheDocument();
    expect(screen.getByText("Antigravity live chat")).toBeInTheDocument();
  });

  it("shows an explicit fallback for unknown generated component types", () => {
    const spec = {
      root: "unknown",
      elements: {
        unknown: { type: "futureWidget", props: {}, children: [] },
      },
    } as Spec;

    render(<GeneratedSpecRenderer spec={spec} registry={registry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unsupported generated component");
    expect(screen.getByRole("alert")).toHaveTextContent("futureWidget");
  });

  it("instructs standalone generation to avoid the unsupported splitPane children path", () => {
    expect(specGenerationSystemPrompt()).toContain("Do not use splitPane in generated specs");
    expect(specGenerationSystemPrompt()).toContain("use grid or container");
  });
});
