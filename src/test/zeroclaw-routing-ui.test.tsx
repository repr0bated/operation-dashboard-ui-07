import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchemaRenderer } from "@/components/json/SchemaRenderer";
import { ZeroclawRoutingPanel } from "@/components/zeroclaw/ZeroclawRoutingPanel";
import schemarsSchema from "./fixtures/zeroclaw-config-schema.json";
import {
  populateRoutingSchema,
  routingFromState,
  routingJsonSchema,
} from "@/lib/zeroclaw-routing";
import type { JsonSchema } from "@/types/api";

const LIVE = {
  selected_provider: "antigravity",
  selected_model: "gemini-2.5-flash",
  model_routes: [
    { id: "gemini-2.5-flash", name: "Gemini Flash", provider: "antigravity", available: true },
    { id: "qwen3.6-35b-a3b", name: "Qwen 3.6", provider: "salad", available: true },
  ],
  providers: ["antigravity", "salad"],
};

describe("SchemaRenderer populates zeroclaw routing from schemars + live state", () => {
  it("shows selected_provider and selected_model values from GetState", () => {
    const schema = routingJsonSchema(schemarsSchema);
    const data = routingFromState(LIVE);

    render(
      <SchemaRenderer schema={schema} data={data} readOnly />,
    );

    expect(screen.getByPlaceholderText("selected_provider")).toHaveValue("antigravity");
    expect(screen.getByPlaceholderText("selected_model")).toHaveValue("gemini-2.5-flash");
    expect(screen.getAllByText("selected_provider").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("selected_model").length).toBeGreaterThanOrEqual(1);
  });

  it("renders model_routes rows from the live projection", () => {
    const schema = routingJsonSchema(schemarsSchema);
    render(
      <SchemaRenderer schema={schema} data={LIVE} readOnly />,
    );

    expect(screen.getAllByDisplayValue("gemini-2.5-flash").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue("qwen3.6-35b-a3b")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Gemini Flash")).toBeInTheDocument();
  });
});

describe("ZeroclawRoutingPanel", () => {
  it("renders the schemars schema populated with live routing, not an empty form", () => {
    const schema = routingJsonSchema(schemarsSchema);
    const populated = populateRoutingSchema(schema, LIVE);
    render(
      <ZeroclawRoutingPanel
        snapshot={{
          schema: schema as JsonSchema,
          populatedSchema: populated as JsonSchema,
          state: LIVE,
        }}
      />,
    );

    expect(screen.getByText(/zeroclaw routing/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("selected_provider")).toHaveValue("antigravity");
    expect(screen.getByPlaceholderText("selected_model")).toHaveValue("gemini-2.5-flash");
    expect(screen.queryByText(/gpt-4o/)).not.toBeInTheDocument();
  });
});
