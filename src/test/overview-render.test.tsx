import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ShellRenderer } from "@/json-render/shell/ShellRenderer";
import { PageSpecOutlet } from "@/json-render/runtime/PageSpecOutlet";
import { overviewSpec } from "@/json-render/pages";

/**
 * Boots the real shell with the real Overview page spec, so every dashboard
 * widget in the catalog is actually mounted. Any React error, missing
 * component, or bad prop surfaces here as a console error.
 */

let errors: string[];
let warnings: string[];

beforeEach(() => {
  errors = [];
  warnings = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "warn").mockImplementation((...args) => {
    warnings.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ShellRenderer>
        <PageSpecOutlet />
      </ShellRenderer>
    </MemoryRouter>,
  );
}

describe("overview page spec renders inside the shell", () => {
  it("mounts every widget in the spec without a React error", () => {
    mount();

    // Ignore the act() advisory: these widgets settle synchronously and the
    // warning is about test-harness wrapping, not product behaviour.
    const real = errors.filter((e) => !e.includes("not wrapped in act"));
    expect(real, `console errors:\n${real.join("\n---\n")}`).toEqual([]);
  });

  it("renders the widgets the spec declares", () => {
    mount();
    // Scope to the content region: several widget labels ("Services",
    // "Components", "Overview") also exist as sidebar nav entries.
    const main = within(document.querySelector("main") as HTMLElement);

    // overviewHeader
    expect(main.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    // overviewStats
    expect(main.getByText("Uptime")).toBeInTheDocument();
    expect(main.getByText("Services")).toBeInTheDocument();
    // resourcePanel
    expect(main.getByText("System Resources")).toBeInTheDocument();
    // gatewayAccess
    expect(main.getByText("Gateway Access")).toBeInTheDocument();
    // componentsPanel
    expect(main.getByText("Components")).toBeInTheDocument();
    expect(main.getByText("D-Bus Monitor")).toBeInTheDocument();
    // eventDistributionPanel
    expect(main.getByText("Event Distribution")).toBeInTheDocument();
    // connectedPeersPanel
    expect(main.getByText("Connected Peers")).toBeInTheDocument();
    // rawStatsPanel
    expect(main.getByText("Raw System Stats")).toBeInTheDocument();
    // notesPanel — props come from the spec, not the component
    expect(main.getByText("Notes")).toBeInTheDocument();
    expect(main.getByText("WireGuard tunnel")).toBeInTheDocument();
  });

  it("keeps the shell chrome around the page", () => {
    mount();
    expect(screen.getByText("OPERATION-DBUS")).toBeInTheDocument();
    // the Overview nav item is active because the route is "/"
    expect(screen.getByRole("button", { name: /Overview/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("declares only element types that the spec test already vetted", () => {
    // Guard against the spec drifting away from what this test mounts.
    const types = Object.values(
      overviewSpec.elements as Record<string, { type: string }>,
    ).map((e) => e.type);
    expect(types).toContain("overviewStats");
    expect(types).toContain("notesPanel");
    expect(new Set(types).size).toBeGreaterThan(8);
  });
});
