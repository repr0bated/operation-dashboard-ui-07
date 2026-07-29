/**
 * The registry: catalog name → implementation.
 *
 * `defineRegistry` type-checks this map against the catalog, so a component
 * declared in the catalog with no implementation (or a typo in either place)
 * is a compile error rather than a blank region at runtime.
 */
import { defineRegistry } from "@json-render/react";
import { getByPath, setByPath } from "@json-render/core";
import { appCatalog } from "./catalog";
import { navigateTo } from "@/json-render/runtime/navigation-bridge";
import * as shell from "./components/shell";
import * as dash from "./components/dashboard";
import * as prim from "./components/primitives";

export const { registry, handlers, executeAction } = defineRegistry(appCatalog, {
  components: {
    // shell chrome
    appShell: shell.AppShellEl,
    topbar: shell.TopbarEl,
    topbarGroup: shell.TopbarGroupEl,
    navToggle: shell.NavToggleEl,
    brand: shell.BrandEl,
    healthPill: shell.HealthPillEl,
    themeToggle: shell.ThemeToggleEl,
    sidebar: shell.SidebarEl,
    navSection: shell.NavSectionEl,
    navItemList: shell.NavItemListEl,
    navItem: shell.NavItemEl,
    navResources: shell.NavResourcesEl,
    contentRegion: shell.ContentRegionEl,
    pageHeader: shell.PageHeaderEl,
    statusBanner: shell.StatusBannerEl,
    emptyState: shell.EmptyStateEl,

    // dashboard
    grid: dash.GridEl,
    cardEl: dash.CardElEl,
    statCard: dash.StatCardEl,
    pill: dash.PillEl,
    statusDot: dash.StatusDotEl,
    callout: dash.CalloutEl,
    notesPanel: dash.NotesPanelEl,
    overviewHeader: dash.OverviewHeaderEl,
    overviewLastError: dash.OverviewLastErrorEl,
    overviewStats: dash.OverviewStatsEl,
    resourcePanel: dash.ResourcePanelEl,
    gatewayAccess: dash.GatewayAccessEl,
    componentsPanel: dash.ComponentsPanelEl,
    eventDistributionPanel: dash.EventDistributionPanelEl,
    connectedPeersPanel: dash.ConnectedPeersPanelEl,
    eventTapePanel: dash.EventTapePanelEl,
    stateProjectionPanel: dash.StateProjectionPanelEl,
    rawStatsPanel: dash.RawStatsPanelEl,

    // data primitives
    container: prim.ContainerEl,
    card: prim.CardEl,
    kv: prim.KvEl,
    heading: prim.HeadingEl,
    text: prim.TextEl,
    badge: prim.BadgeEl,
    row: prim.RowEl,
    code: prim.CodeEl,
  },

  actions: {
    /** Route change — delegated to the router through the bridge. */
    navigate: async (params) => {
      if (params?.route) navigateTo(params.route);
    },

    /** Invert the boolean at a JSON Pointer path (sidebar / section collapse). */
    toggleState: async (params, setState) => {
      const path = params?.statePath;
      if (!path) return;
      setState((prev) => {
        const next: Record<string, unknown> = structuredClone(prev);
        setByPath(next, path, !getByPath(next, path));
        return next;
      });
    },
  },
});

/**
 * Back-compat alias. Older call sites render specs with
 * `<Renderer registry={baseRegistry} />`; they now get the catalog-checked
 * registry instead of a hand-maintained map.
 */
export const baseRegistry = registry;
