import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ShellRenderer } from "@/json-render/shell/ShellRenderer";

/** Shows the live router path so navigation can be asserted. */
function RouteProbe() {
  const { pathname } = useLocation();
  return <div data-testid="route">{pathname}</div>;
}

function mountShell(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ShellRenderer>
        <RouteProbe />
      </ShellRenderer>
    </MemoryRouter>,
  );
}

describe("spec-driven shell renders", () => {
  it("paints the topbar chrome from the spec", () => {
    mountShell();
    expect(screen.getByText("OPERATION-DBUS")).toBeInTheDocument();
    expect(screen.getByText("Control Plane")).toBeInTheDocument();
    // health pill
    expect(screen.getByText("Health")).toBeInTheDocument();
    // three-way theme switcher
    expect(screen.getByTitle("dark")).toBeInTheDocument();
    expect(screen.getByTitle("light")).toBeInTheDocument();
    expect(screen.getByTitle("system")).toBeInTheDocument();
  });

  it("paints sidebar sections and items generated from the manifest", () => {
    mountShell();
    // section headers
    expect(screen.getByText("Control")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("UI Model")).toBeInTheDocument();
    // items
    expect(screen.getByRole("button", { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open vSwitch/ })).toBeInTheDocument();
    // trailing resources block
    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Docs/ })).toBeInTheDocument();
  });

  it("renders host children into the content slot", () => {
    mountShell("/");
    expect(screen.getByTestId("route")).toHaveTextContent("/");
  });

  it("marks the item for the current route as active", () => {
    mountShell("/containers");
    const active = screen.getByRole("button", { name: /Containers/ });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /Overview/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("navigates when a nav item fires its bound action", () => {
    mountShell("/");
    expect(screen.getByTestId("route")).toHaveTextContent("/");

    fireEvent.click(screen.getByRole("button", { name: /Open vSwitch/ }));

    expect(screen.getByTestId("route")).toHaveTextContent("/ovs");
    // active highlight follows the route through shell state
    expect(screen.getByRole("button", { name: /Open vSwitch/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("disables placeholder entries instead of navigating", () => {
    mountShell("/");
    const soon = screen.getByRole("button", { name: /Dreams/ });
    expect(soon).toBeDisabled();

    fireEvent.click(soon);
    expect(screen.getByTestId("route")).toHaveTextContent("/");
  });

  it("collapses the sidebar through the toggleState action", () => {
    mountShell();
    const toggle = screen.getByTitle("Collapse sidebar");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);

    const expanded = screen.getByTitle("Expand sidebar");
    expect(expanded).toHaveAttribute("aria-expanded", "false");
  });

  it("hides a section's items when its header is toggled", () => {
    mountShell("/");
    // "Infrastructure" does not hold the active route ("/" is in Control),
    // so collapsing it must hide its items.
    expect(screen.getByRole("button", { name: /Containers/ })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Infrastructure"));

    expect(screen.queryByRole("button", { name: /Containers/ })).not.toBeInTheDocument();
    // the active section is untouched
    expect(screen.getByRole("button", { name: /Overview/ })).toBeInTheDocument();
  });

  it("keeps the section holding the active route open when collapsed", () => {
    mountShell("/ovs");
    const header = screen.getByText("Infrastructure");

    fireEvent.click(header);

    // still visible: the $or visibility condition matches activeSection
    expect(screen.getByRole("button", { name: /Open vSwitch/ })).toBeInTheDocument();
  });

  it("applies full-height content styling only on declared routes", () => {
    const { unmount } = mountShell("/");
    const main = document.querySelector("main");
    expect(main?.className).toContain("space-y-6");
    expect(main?.className).not.toContain("overflow-hidden");
    unmount();

    mountShell("/chat");
    const fullHeight = document.querySelector("main");
    expect(fullHeight?.className).toContain("overflow-hidden");
  });

  it("nests the shell as topbar + nav + content grid areas", () => {
    mountShell();
    const header = document.querySelector("header");
    const aside = document.querySelector("aside");
    const main = document.querySelector("main");
    expect(header).toBeInTheDocument();
    expect(aside).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    // the sidebar nav items live in the aside, not the topbar
    expect(
      within(aside as HTMLElement).getByRole("button", { name: /Overview/ }),
    ).toBeInTheDocument();
  });
});
