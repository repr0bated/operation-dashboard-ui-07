import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ShellRenderer } from "@/json-render/shell/ShellRenderer";
import { buildShellSpec } from "@/json-render/shell/shellSpec";
import { NAV_MANIFEST, type NavItem } from "@/json-render/navigation/manifest";
import type { Spec, UIElement } from "@json-render/core";

const elementsOf = (spec: Spec) => spec.elements as Record<string, UIElement>;

function RouteProbe() {
  const { pathname } = useLocation();
  return <div data-testid="route">{pathname}</div>;
}

function mountShell(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ShellRenderer>
        <RouteProbe />
      </ShellRenderer>
    </MemoryRouter>,
  );
}

/**
 * Work-in-progress marking is manifest-driven: `wip: true` on a nav entry must
 * produce both the sidebar badge and the on-page banner with no per-page code.
 *
 * The criterion for `wip` is *mock/static content*, not brokenness — a page
 * that calls a real backend and fails must NOT be marked, because that failure
 * is useful signal.
 */
describe("WIP marking is driven by the manifest", () => {
  const wipItems = NAV_MANIFEST.filter((i) => i.wip);

  it("marks the pages found to have no backend wiring", () => {
    expect(wipItems.map((i) => i.id).sort()).toEqual(
      ["channels", "cron", "estop", "gateway", "hardware", "integrations"].sort(),
    );
  });

  it("gives every WIP entry an explicit reason", () => {
    for (const item of wipItems) {
      expect(item.wipReason, `${item.id} has no wipReason`).toBeTruthy();
      expect(item.wipReason!.length).toBeGreaterThan(20);
    }
  });

  it("never marks a page both placeholder and wip", () => {
    for (const item of NAV_MANIFEST) {
      expect(item.placeholder && item.wip).toBeFalsy();
    }
  });

  it("propagates the flag into the nav element and the content region", () => {
    const els = elementsOf(buildShellSpec());

    for (const item of wipItems) {
      expect(els[`nav-item-${item.id}`].props.wip).toBe(true);
    }
    // Non-WIP entries are explicitly false, not undefined.
    expect(els["nav-item-overview"].props.wip).toBe(false);

    const wipRoutes = els.content.props.wipRoutes as { route: string; reason: string }[];
    expect(wipRoutes.map((w) => w.route).sort()).toEqual(
      wipItems.map((i) => i.route).sort(),
    );
  });

  it("renders a WIP badge in the sidebar for those entries", () => {
    mountShell("/");
    const aside = within(document.querySelector("aside") as HTMLElement);
    // one badge per WIP entry
    expect(aside.getAllByText("WIP")).toHaveLength(wipItems.length);
    // and the entry is still clickable (partially functional pages are useful)
    expect(aside.getByRole("button", { name: /Cron/ })).toBeEnabled();
  });

  it("shows the banner with the reason when a WIP route is active", () => {
    mountShell("/cron");
    const main = within(document.querySelector("main") as HTMLElement);
    expect(main.getByText("Work in progress")).toBeInTheDocument();
    const cron = NAV_MANIFEST.find((i) => i.id === "cron")!;
    expect(main.getByText(cron.wipReason!)).toBeInTheDocument();
  });

  it("shows no banner on a live route", () => {
    mountShell("/");
    expect(screen.queryByText("Work in progress")).not.toBeInTheDocument();
  });

  it("adding wip to a new entry needs no page or shell edit", () => {
    const extra: NavItem = {
      id: "widgets",
      label: "Widgets",
      route: "/widgets",
      icon: "Package",
      section: "Control",
      order: 999,
      wip: true,
      wipReason: "Freshly scaffolded — no data source wired yet at all.",
    };
    const els = elementsOf(buildShellSpec([...NAV_MANIFEST, extra]));

    expect(els["nav-item-widgets"].props.wip).toBe(true);
    const wipRoutes = els.content.props.wipRoutes as { route: string; reason: string }[];
    expect(wipRoutes).toEqual(
      expect.arrayContaining([{ route: "/widgets", reason: extra.wipReason }]),
    );
  });

  it("falls back to a generic reason when none is given", () => {
    const extra: NavItem = {
      id: "noreason",
      label: "NoReason",
      route: "/no-reason",
      icon: "Package",
      section: "Control",
      order: 998,
      wip: true,
    };
    const els = elementsOf(buildShellSpec([...NAV_MANIFEST, extra]));
    const wipRoutes = els.content.props.wipRoutes as { route: string; reason: string }[];
    const entry = wipRoutes.find((w) => w.route === "/no-reason");
    expect(entry?.reason).toMatch(/not wired to live control-plane data/);
  });
});
