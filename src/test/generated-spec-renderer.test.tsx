import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Spec } from "@json-render/core";
import type { ComponentRegistry } from "@json-render/react";
import { GeneratedSpecRenderer } from "@/json-render/runtime/GeneratedSpecRenderer";
import { uiStore } from "@/json-render/store/ui-store";

const registry: ComponentRegistry = {
  container: ({ children }) => <section>{children}</section>,
  heading: ({ element }) => <h1>{String(element.props.text ?? "")}</h1>,
  text: ({ element }) => <p>{String(element.props.text ?? "")}</p>,
  trigger: ({ element, emit }) => (
    <button type="button" onClick={() => emit("press")}>
      {String(element.props.label ?? "Update")}
    </button>
  ),
};

function stateHeavySpec(overrides: Record<string, unknown> = {}): Spec {
  return {
    root: "root",
    state: {
      dataset: {
        title: "Community Services",
        updated: "August",
        formats: [
          { id: "csv", name: "CSV" },
          { id: "json", name: "JSON" },
        ],
        ...overrides,
      },
    },
    elements: {
      root: {
        type: "container",
        props: {},
        children: ["title", "updated", "formats", "live-plugin", "local-update", "blocked-update"],
      },
      title: {
        type: "heading",
        props: { text: { $state: "/dataset/title" } },
        children: [],
      },
      updated: {
        type: "text",
        props: { text: { $template: "Updated ${/dataset/updated}" } },
        children: [],
      },
      formats: {
        type: "container",
        props: {},
        repeat: { statePath: "/dataset/formats", key: "id" },
        children: ["format-name"],
      },
      "format-name": {
        type: "text",
        props: { text: { $item: "name" } },
        children: [],
      },
      "live-plugin": {
        type: "text",
        props: { text: { $state: "/plugins/generated-overlay-test/value" } },
        children: [],
      },
      "local-update": {
        type: "trigger",
        props: { label: "Rename locally" },
        children: [],
        on: {
          press: {
            action: "setState",
            params: { statePath: "/dataset/title", value: "Locally renamed" },
          },
        },
      },
      "blocked-update": {
        type: "trigger",
        props: { label: "Overwrite live plugin" },
        children: [],
        on: {
          press: {
            action: "setState",
            params: {
              statePath: "/plugins/generated-overlay-test/value",
              value: "generated write",
            },
          },
        },
      },
    },
  } as Spec;
}

let pluginsBefore: unknown;

afterEach(() => {
  if (pluginsBefore !== undefined) act(() => uiStore.set("/plugins", pluginsBefore));
  pluginsBefore = undefined;
});

describe("GeneratedSpecRenderer", () => {
  it("hydrates bindings and repeats, reconciles streamed state, and stays isolated", async () => {
    const globalDatasetBefore = uiStore.get("/dataset");
    pluginsBefore = structuredClone(uiStore.get("/plugins") ?? {});
    uiStore.set("/plugins/generated-overlay-test", { value: "live one" });
    const spec = stateHeavySpec();
    spec.state = {
      ...spec.state,
      plugins: { "generated-overlay-test": { value: "generated shadow" } },
    };
    const { rerender } = render(
      <GeneratedSpecRenderer spec={spec} registry={registry} />,
    );

    expect(screen.getByRole("heading", { name: "Community Services" })).toBeInTheDocument();
    expect(screen.getByText("Updated August")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("live one")).toBeInTheDocument();
    expect(screen.queryByText("generated shadow")).not.toBeInTheDocument();
    expect(uiStore.get("/dataset")).toBe(globalDatasetBefore);

    act(() => uiStore.set("/plugins/generated-overlay-test/value", "live two"));
    await waitFor(() => expect(screen.getByText("live two")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Overwrite live plugin" }));
    expect(screen.getByText("live two")).toBeInTheDocument();
    expect(uiStore.get("/plugins/generated-overlay-test/value")).toBe("live two");

    fireEvent.click(screen.getByRole("button", { name: "Rename locally" }));
    expect(screen.getByRole("heading", { name: "Locally renamed" })).toBeInTheDocument();

    rerender(
      <GeneratedSpecRenderer
        spec={stateHeavySpec({
          updated: "September",
          formats: [
            { id: "csv", name: "CSV" },
            { id: "json", name: "JSON" },
            { id: "parquet", name: "Parquet" },
          ],
        })}
        registry={registry}
      />,
    );

    await waitFor(() => expect(screen.getByText("Updated September")).toBeInTheDocument());
    expect(screen.getByText("Parquet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Locally renamed" })).toBeInTheDocument();
    expect(uiStore.get("/dataset")).toBe(globalDatasetBefore);

    // The streaming compiler shallow-clones Spec but retains and mutates the
    // nested state object, so state identity alone cannot drive reconciliation.
    const reusedState = stateHeavySpec({ title: "Streamed title", updated: "September" }).state!;
    rerender(<GeneratedSpecRenderer spec={{ ...stateHeavySpec(), state: reusedState }} registry={registry} />);
    (reusedState.dataset as Record<string, unknown>).title = "Mutated streamed title";
    rerender(
      <GeneratedSpecRenderer
        spec={{ ...stateHeavySpec(), state: reusedState }}
        registry={registry}
      />,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Mutated streamed title" })).toBeInTheDocument());
    expect(uiStore.get("/dataset")).toBe(globalDatasetBefore);
  });
});
