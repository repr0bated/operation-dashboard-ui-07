/**
 * The shell, as a spec.
 *
 * This file replaces the hand-written `AppShell.tsx`. The topbar, sidebar and
 * content region are spec elements; the sidebar's sections and items are
 * *generated from the nav manifest*, so adding a navigation entry is a single
 * line in `navigation/manifest.ts` — no JSX, no route wiring, no spec edit.
 *
 * State contract (JSON Pointer paths, see `SHELL_STATE`):
 *   /shell/navCollapsed              boolean  — sidebar collapsed
 *   /shell/route                     string   — current pathname
 *   /shell/activeSection             string   — slug of section holding /route
 *   /shell/collapsedSections/<slug>  boolean  — per-section collapse
 */
import type { Spec, UIElement } from "@json-render/core";
import {
  NAV_MANIFEST,
  buildNavGroups,
  sectionSlug,
  type NavItem,
} from "@/json-render/navigation/manifest";
import { ALLOW_ALL, type CapabilitySet } from "@/json-render/navigation/capabilities";
import { CONTENT_SLOT } from "@/json-render/runtime/slots";

// ── state paths ───────────────────────────────────────────────────────────

export const SHELL_STATE = {
  navCollapsed: "/shell/navCollapsed",
  route: "/shell/route",
  activeSection: "/shell/activeSection",
  collapsedSection: (slug: string) => `/shell/collapsedSections/${slug}`,
} as const;

/** Initial state model for the shell. */
export function shellInitialState(route: string) {
  return {
    shell: {
      navCollapsed: false,
      route,
      activeSection: "",
      collapsedSections: {} as Record<string, boolean>,
    },
  };
}

// ── chrome content (data, not markup) ─────────────────────────────────────

export interface ShellChrome {
  brandTitle: string;
  brandSubtitle: string;
  brandIcon: string;
  navWidth: string;
  collapsedNavWidth: string;
  topbarHeight: string;
  themeModes: ("dark" | "light" | "system")[];
  resourcesLabel: string;
  resourceLinks: { label: string; href: string; icon: string | null }[];
  /** Routes rendered edge-to-edge (no padding / own scroll container). */
  fullHeightRoutes: string[];
}

export const DEFAULT_CHROME: ShellChrome = {
  brandTitle: "OPERATION-DBUS",
  brandSubtitle: "Control Plane",
  brandIcon: "Shield",
  navWidth: "220px",
  collapsedNavWidth: "0px",
  topbarHeight: "56px",
  themeModes: ["dark", "light", "system"],
  resourcesLabel: "Resources",
  resourceLinks: [
    { label: "Docs", href: "https://docs.operation-dbus.dev", icon: "FileText" },
    {
      label: "Prometheus",
      href: (import.meta.env.VITE_PROMETHEUS_URL as string | undefined) || "http://127.0.0.1:9090",
      icon: "Activity",
    },
    {
      label: "Grafana",
      href: (import.meta.env.VITE_GRAFANA_URL as string | undefined) || "http://127.0.0.1:3000",
      icon: "BarChart3",
    },
    {
      label: "json-render",
      href: "https://json-render.dev/docs",
      icon: "FileText",
    },
  ],
  fullHeightRoutes: ["/chat", "/workflows", "/accountability", "/network"],
};

// ── builder ───────────────────────────────────────────────────────────────

type Elements = Record<string, UIElement>;

/**
 * Build the shell spec for a manifest + capability set.
 *
 * Capability filtering happens here, which means an operator without a
 * capability never receives the corresponding nav element in the spec at all.
 */
export function buildShellSpec(
  manifest: NavItem[] = NAV_MANIFEST,
  caps: CapabilitySet = ALLOW_ALL,
  chrome: ShellChrome = DEFAULT_CHROME,
): Spec {
  const elements: Elements = {};
  const groups = buildNavGroups(manifest, caps);

  // ── topbar ──
  elements["topbar-left"] = {
    type: "topbarGroup",
    props: { align: "start" },
    children: ["nav-toggle", "brand"],
  };
  elements["nav-toggle"] = {
    type: "navToggle",
    props: {
      collapsed: { $state: SHELL_STATE.navCollapsed },
      expandTitle: "Expand sidebar",
      collapseTitle: "Collapse sidebar",
    },
    children: [],
    on: {
      press: {
        action: "toggleState",
        params: { statePath: SHELL_STATE.navCollapsed },
      },
    },
  };
  elements["brand"] = {
    type: "brand",
    props: {
      title: chrome.brandTitle,
      subtitle: chrome.brandSubtitle,
      icon: chrome.brandIcon,
    },
    children: [],
  };
  elements["topbar-right"] = {
    type: "topbarGroup",
    props: { align: "end" },
    children: ["health-pill", "theme-toggle"],
  };
  elements["health-pill"] = {
    type: "healthPill",
    props: { label: "Health", okText: "OK", offlineText: "Offline" },
    children: [],
  };
  elements["theme-toggle"] = {
    type: "themeToggle",
    props: { modes: chrome.themeModes },
    children: [],
  };
  elements["topbar"] = {
    type: "topbar",
    props: {},
    children: ["topbar-left", "topbar-right"],
  };

  // ── sidebar: one navSection + navItemList per manifest section ──
  const sidebarChildren: string[] = [];
  for (const group of groups) {
    const slug = sectionSlug(group.section);
    const sectionKey = `nav-section-${slug}`;
    const listKey = `nav-list-${slug}`;

    const itemKeys = group.items.map((item) => {
      const key = `nav-item-${item.id}`;
      elements[key] = {
        type: "navItem",
        props: {
          label: item.label,
          route: item.route,
          icon: item.icon,
          placeholder: item.placeholder ?? false,
          placeholderHint: item.placeholder ? "Coming soon" : null,
          wip: item.wip ?? false,
          activeRoute: { $state: SHELL_STATE.route },
        },
        children: [],
        // Placeholder entries have no destination, so no binding at all.
        ...(item.placeholder
          ? {}
          : {
              on: {
                press: { action: "navigate", params: { route: item.route } },
              },
            }),
      };
      return key;
    });

    // Visible when the section is not collapsed OR it holds the active route.
    elements[listKey] = {
      type: "navItemList",
      props: {},
      children: itemKeys,
      visible: {
        $or: [
          { $state: SHELL_STATE.collapsedSection(slug), not: true },
          { $state: SHELL_STATE.activeSection, eq: slug },
        ],
      },
    };

    elements[sectionKey] = {
      type: "navSection",
      props: {
        label: group.section,
        sectionKey: slug,
        collapsed: { $state: SHELL_STATE.collapsedSection(slug) },
        activeSection: { $state: SHELL_STATE.activeSection },
      },
      children: [listKey],
      on: {
        toggle: {
          action: "toggleState",
          params: { statePath: SHELL_STATE.collapsedSection(slug) },
        },
      },
    };

    sidebarChildren.push(sectionKey);
  }

  elements["nav-resources"] = {
    type: "navResources",
    props: { label: chrome.resourcesLabel, links: chrome.resourceLinks },
    children: [],
  };
  sidebarChildren.push("nav-resources");

  elements["sidebar"] = {
    type: "sidebar",
    props: { collapsed: { $state: SHELL_STATE.navCollapsed } },
    children: sidebarChildren,
  };

  // ── content ──
  // WIP routes are derived from the manifest, so marking `wip: true` on a nav
  // entry is the only edit needed to get both the sidebar badge and the banner.
  const wipRoutes = manifest
    .filter((i) => i.wip && !i.placeholder)
    .map((i) => ({
      route: i.route,
      reason: i.wipReason ?? "This page is not wired to live control-plane data yet.",
    }));

  elements["content"] = {
    type: "contentRegion",
    props: {
      slot: CONTENT_SLOT,
      route: { $state: SHELL_STATE.route },
      fullHeightRoutes: chrome.fullHeightRoutes,
      wipRoutes,
    },
    children: [],
  };

  // ── root ──
  elements["shell"] = {
    type: "appShell",
    props: {
      navWidth: chrome.navWidth,
      collapsedNavWidth: chrome.collapsedNavWidth,
      topbarHeight: chrome.topbarHeight,
      collapsed: { $state: SHELL_STATE.navCollapsed },
    },
    children: ["topbar", "sidebar", "content"],
  };

  return { root: "shell", elements };
}

/** The shell spec for the full manifest with no capability filtering. */
export const shellSpec: Spec = buildShellSpec();

export { CONTENT_SLOT };
