import { describe, it, expect } from "vitest";
import { validateSpec } from "@json-render/core";
import type { Spec, UIElement } from "@json-render/core";
import { z } from "zod";
import {
  appCatalog,
  CATALOG_COMPONENTS,
  CATALOG_ACTIONS,
} from "@/json-render/catalog/catalog";
import { registry } from "@/json-render/catalog/registry";
import { buildShellSpec, SHELL_STATE } from "@/json-render/shell/shellSpec";
import {
  NAV_MANIFEST,
  sectionSlug,
  activeSectionSlug,
  type NavItem,
} from "@/json-render/navigation/manifest";
import type { CapabilitySet } from "@/json-render/navigation/capabilities";
import { PAGE_SPECS, pageSpecFor } from "@/json-render/pages";

const elementsOf = (spec: Spec) => spec.elements as Record<string, UIElement>;

/** Prop names the catalog declares for a component type. */
function catalogPropKeys(type: string): string[] {
  const comps = (appCatalog.data as { components: Record<string, { props: z.ZodType }> })
    .components;
  const props = comps[type]?.props as unknown as { shape?: Record<string, unknown> };
  return Object.keys(props?.shape ?? {});
}

describe("shell spec: structure", () => {
  const spec = buildShellSpec();

  it("is structurally valid json-render", () => {
    const result = validateSpec(spec, { checkOrphans: true });
    expect(result.issues, JSON.stringify(result.issues, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("roots at the appShell and contains topbar, sidebar and content", () => {
    const els = elementsOf(spec);
    expect(spec.root).toBe("shell");
    expect(els.shell.type).toBe("appShell");
    expect(els.shell.children).toEqual(["topbar", "sidebar", "content"]);
    expect(els.topbar.type).toBe("topbar");
    expect(els.sidebar.type).toBe("sidebar");
    expect(els.content.type).toBe("contentRegion");
  });

  it("only uses component types declared in the catalog", () => {
    const allowed = new Set(CATALOG_COMPONENTS);
    for (const [key, el] of Object.entries(elementsOf(spec))) {
      expect(allowed.has(el.type), `${key} uses uncatalogued type "${el.type}"`).toBe(true);
    }
  });

  it("only sets props declared by the catalog for each component", () => {
    for (const [key, el] of Object.entries(elementsOf(spec))) {
      const allowed = new Set(catalogPropKeys(el.type));
      for (const prop of Object.keys(el.props ?? {})) {
        expect(allowed.has(prop), `${key} (${el.type}) sets undeclared prop "${prop}"`).toBe(
          true,
        );
      }
    }
  });

  it("only binds actions declared in the catalog", () => {
    const allowed = new Set(CATALOG_ACTIONS);
    for (const [key, el] of Object.entries(elementsOf(spec))) {
      for (const [event, binding] of Object.entries(el.on ?? {})) {
        const bindings = Array.isArray(binding) ? binding : [binding];
        for (const b of bindings) {
          expect(
            allowed.has(b.action),
            `${key}.on.${event} uses uncatalogued action "${b.action}"`,
          ).toBe(true);
        }
      }
    }
  });

  it("has an implementation for every component type it emits", () => {
    for (const el of Object.values(elementsOf(spec))) {
      expect(registry[el.type], `no registry entry for "${el.type}"`).toBeDefined();
    }
  });
});

describe("shell spec: navigation is generated from the manifest", () => {
  const spec = buildShellSpec();
  const els = elementsOf(spec);

  it("emits one navItem per manifest entry, with its route", () => {
    const navItems = Object.entries(els).filter(([, el]) => el.type === "navItem");
    expect(navItems).toHaveLength(NAV_MANIFEST.length);

    for (const item of NAV_MANIFEST) {
      const el = els[`nav-item-${item.id}`];
      expect(el, `missing nav element for "${item.id}"`).toBeDefined();
      expect(el.props.label).toBe(item.label);
      expect(el.props.route).toBe(item.route);
    }
  });

  it("wires a navigate action for real entries and none for placeholders", () => {
    for (const item of NAV_MANIFEST) {
      const el = els[`nav-item-${item.id}`];
      if (item.placeholder) {
        expect(el.on, `placeholder "${item.id}" should not navigate`).toBeUndefined();
      } else {
        expect(el.on?.press).toEqual({
          action: "navigate",
          params: { route: item.route },
        });
      }
    }
  });

  it("puts every section's items behind a collapse/active visibility condition", () => {
    const sections = [...new Set(NAV_MANIFEST.map((i) => sectionSlug(i.section)))];
    for (const slug of sections) {
      const list = els[`nav-list-${slug}`];
      expect(list, `missing item list for section "${slug}"`).toBeDefined();
      expect(list.visible).toEqual({
        $or: [
          { $state: SHELL_STATE.collapsedSection(slug), not: true },
          { $state: SHELL_STATE.activeSection, eq: slug },
        ],
      });
    }
  });

  it("binds the sidebar and toggle to the same collapse state path", () => {
    expect(els.sidebar.props.collapsed).toEqual({ $state: SHELL_STATE.navCollapsed });
    expect(els["nav-toggle"].on?.press).toEqual({
      action: "toggleState",
      params: { statePath: SHELL_STATE.navCollapsed },
    });
  });
});

describe("the add-a-screen workflow", () => {
  const extraEntry: NavItem = {
    id: "widgets",
    label: "Widgets",
    route: "/widgets",
    icon: "Package",
    section: "Control",
    order: 999,
  };

  it("adding one manifest entry adds the nav item — no shell edit", () => {
    const before = buildShellSpec();
    const after = buildShellSpec([...NAV_MANIFEST, extraEntry]);

    expect(elementsOf(before)["nav-item-widgets"]).toBeUndefined();

    const added = elementsOf(after)["nav-item-widgets"];
    expect(added).toBeDefined();
    expect(added.type).toBe("navItem");
    expect(added.on?.press).toEqual({
      action: "navigate",
      params: { route: "/widgets" },
    });

    // and it lands inside its declared section
    const list = elementsOf(after)[`nav-list-${sectionSlug("Control")}`];
    expect(list.children).toContain("nav-item-widgets");
  });

  it("registering a route in PAGE_SPECS is what makes it render a spec", () => {
    expect(pageSpecFor("/")).toBe(PAGE_SPECS["/"]);
    // An unregistered route falls through to its React page.
    expect(pageSpecFor("/chat")).toBeUndefined();
  });

  it("capability filtering removes the element from the spec entirely", () => {
    const gated: NavItem = { ...extraEntry, requiredCapabilities: ["widgets.read"] };
    const denyWidgets: CapabilitySet = { has: (c) => c !== "widgets.read" };

    const allowed = buildShellSpec([...NAV_MANIFEST, gated]);
    const denied = buildShellSpec([...NAV_MANIFEST, gated], denyWidgets);

    expect(elementsOf(allowed)["nav-item-widgets"]).toBeDefined();
    expect(elementsOf(denied)["nav-item-widgets"]).toBeUndefined();
  });
});

describe("route → section resolution", () => {
  it("resolves an exact route to its section", () => {
    expect(activeSectionSlug("/chat")).toBe(sectionSlug("Chat"));
    expect(activeSectionSlug("/containers")).toBe(sectionSlug("Infrastructure"));
  });

  it("does not treat '/' as a prefix of every route", () => {
    expect(activeSectionSlug("/")).toBe(sectionSlug("Control"));
    expect(activeSectionSlug("/nope-not-a-route")).toBe("");
  });

  it("produces pointer-safe slugs for sections with spaces", () => {
    expect(sectionSlug("UI Model")).toBe("ui-model");
    expect(sectionSlug("Coming Soon")).toBe("coming-soon");
    expect(SHELL_STATE.collapsedSection(sectionSlug("UI Model"))).toBe(
      "/shell/collapsedSections/ui-model",
    );
  });
});

describe("page specs", () => {
  it("only use catalogued components and have implementations", () => {
    const allowed = new Set(CATALOG_COMPONENTS);
    for (const [route, spec] of Object.entries(PAGE_SPECS)) {
      const result = validateSpec(spec);
      expect(result.issues, `${route}: ${JSON.stringify(result.issues)}`).toEqual([]);
      for (const [key, el] of Object.entries(elementsOf(spec))) {
        expect(allowed.has(el.type), `${route}/${key}: "${el.type}" not in catalog`).toBe(
          true,
        );
        expect(registry[el.type], `${route}/${key}: no implementation`).toBeDefined();
      }
    }
  });
});
