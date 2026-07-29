/**
 * The catalog — the single contract for everything a json-render spec may
 * contain in this app. Nothing renders that is not declared here.
 *
 * Three groups:
 *   • shell        — the permanent chrome (topbar, sidebar, content region).
 *                    This is what used to be the hand-written `AppShell.tsx`.
 *   • dashboard    — layout primitives + live Overview widgets.
 *   • data         — generic JSON/value primitives (kv/card/heading/...) used
 *                    by the gRPC explorer and the plugin-schema renderer.
 *
 * Because this is a real `defineCatalog`, we get for free:
 *   catalog.prompt()      → LLM system prompt describing the whole surface
 *   catalog.jsonSchema()  → JSON Schema for structured-output generation
 *   catalog.validate(spec)→ spec validation before render
 */
import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

/** Tone shared by banners, pills and cards. */
const tone = z.enum(["default", "ok", "warn", "danger"]);
/** Status shared by the status dot. */
const status = z.enum(["ok", "warn", "error", "offline"]);

export const appCatalog = defineCatalog(schema, {
  components: {
    // ───────────────────────────── shell ─────────────────────────────
    appShell: {
      props: z.object({
        /** Sidebar width when expanded, e.g. "220px". */
        navWidth: z.string(),
        /** Sidebar width when collapsed, e.g. "0px". */
        collapsedNavWidth: z.string(),
        /** Topbar height, e.g. "56px". */
        topbarHeight: z.string(),
        /** Bound to state: whether the sidebar is collapsed. */
        collapsed: z.boolean().nullable(),
      }),
      slots: ["default"],
      description:
        "Root application chrome: CSS grid with a topbar row and a nav/content row. Children are the topbar, sidebar and content region.",
    },

    topbar: {
      props: z.object({}),
      slots: ["default"],
      description: "Fixed top header bar of the shell.",
    },

    topbarGroup: {
      props: z.object({
        align: z.enum(["start", "end"]).nullable(),
      }),
      slots: ["default"],
      description:
        "Horizontal cluster inside the topbar. align=start hugs the left, align=end hugs the right.",
    },

    navToggle: {
      props: z.object({
        collapsed: z.boolean().nullable(),
        expandTitle: z.string(),
        collapseTitle: z.string(),
      }),
      slots: [],
      description:
        "Hamburger button that collapses/expands the sidebar. Emits 'press'.",
    },

    brand: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
        icon: z.string().nullable(),
      }),
      slots: [],
      description: "Product lockup: icon badge plus title and subtitle.",
    },

    healthPill: {
      props: z.object({
        label: z.string(),
        okText: z.string(),
        offlineText: z.string(),
      }),
      slots: [],
      description:
        "Live connection pill. Reads the event-stream store; shows okText when connected.",
    },

    themeToggle: {
      props: z.object({
        modes: z.array(z.enum(["dark", "light", "system"])),
      }),
      slots: [],
      description: "Segmented theme switcher for the listed modes.",
    },

    sidebar: {
      props: z.object({
        collapsed: z.boolean().nullable(),
      }),
      slots: ["default"],
      description:
        "Left navigation rail. Children are navSection groups followed by navResources.",
    },

    navSection: {
      props: z.object({
        label: z.string(),
        /** Stable slug for this section, used for state paths and comparisons. */
        sectionKey: z.string(),
        /** Bound to state: whether this section is collapsed. */
        collapsed: z.boolean().nullable(),
        /** Bound to state: slug of the section containing the active route. */
        activeSection: z.string().nullable(),
      }),
      slots: ["default"],
      description:
        "Collapsible sidebar group with a clickable header. Emits 'toggle'. Its single child is a navItemList. A section holding the active route stays open.",
    },

    navItemList: {
      props: z.object({}),
      slots: ["default"],
      description:
        "Container for a section's nav items. Carries the visibility condition that hides a collapsed section.",
    },

    navItem: {
      props: z.object({
        label: z.string(),
        route: z.string(),
        icon: z.string().nullable(),
        placeholder: z.boolean().nullable(),
        placeholderHint: z.string().nullable(),
        /** Renders but is not wired to live data. */
        wip: z.boolean().nullable(),
        /** Bound to state: the currently active route. */
        activeRoute: z.string().nullable(),
      }),
      slots: [],
      description:
        "Single navigation entry. Highlights itself when route === activeRoute. Shows a WIP marker when wip is set. Emits 'press'.",
    },

    navResources: {
      props: z.object({
        label: z.string(),
        links: z.array(
          z.object({
            label: z.string(),
            href: z.string(),
            icon: z.string().nullable(),
          }),
        ),
      }),
      slots: [],
      description: "Trailing sidebar block of external documentation links.",
    },

    contentRegion: {
      props: z.object({
        /** Named slot filled by the host application (default: "content"). */
        slot: z.string().nullable(),
        /** Bound to state: the currently active route. */
        route: z.string().nullable(),
        /** Routes that render edge-to-edge with no padding or scroll gutter. */
        fullHeightRoutes: z.array(z.string()),
        /**
         * Routes whose page is not wired to live data, with the reason. Driven
         * from the nav manifest so a page never needs its own WIP code.
         */
        wipRoutes: z.array(z.object({ route: z.string(), reason: z.string() })),
      }),
      slots: ["default"],
      description:
        "Main scrollable region. Renders the host-provided slot content, prefixed by a work-in-progress banner when the active route is listed in wipRoutes.",
    },

    pageHeader: {
      props: z.object({
        title: z.string(),
        subtitle: z.string().nullable(),
      }),
      slots: [],
      description: "Page title block.",
    },

    statusBanner: {
      props: z.object({
        message: z.string().nullable(),
        title: z.string().nullable(),
        tone: tone.nullable(),
      }),
      slots: [],
      description: "Inline banner for backend errors or notices.",
    },

    emptyState: {
      props: z.object({
        title: z.string(),
        hint: z.string().nullable(),
      }),
      slots: [],
      description: "Placeholder shown when a surface has no data.",
    },

    // ─────────────────────────── dashboard ───────────────────────────
    grid: {
      props: z.object({
        cols: z.number().nullable(),
        gap: z.number().nullable(),
        className: z.string().nullable(),
      }),
      slots: ["default"],
      description: "Responsive CSS grid container.",
    },

    cardEl: {
      props: z.object({
        title: z.string().nullable(),
        subtitle: z.string().nullable(),
        className: z.string().nullable(),
      }),
      slots: ["default"],
      description: "Titled surface card.",
    },

    statCard: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        sub: z.string().nullable(),
        variant: tone.nullable(),
      }),
      slots: [],
      description: "Single headline metric.",
    },

    pill: {
      props: z.object({
        text: z.string(),
        variant: tone.nullable(),
      }),
      slots: [],
      description: "Small rounded status label.",
    },

    statusDot: {
      props: z.object({ status }),
      slots: [],
      description: "Coloured health dot.",
    },

    callout: {
      props: z.object({ variant: tone.nullable() }),
      slots: ["default"],
      description: "Emphasised inline message block.",
    },

    notesPanel: {
      props: z.object({
        title: z.string().nullable(),
        subtitle: z.string().nullable(),
        notes: z.array(z.object({ title: z.string(), desc: z.string() })),
      }),
      slots: [],
      description: "Card listing static title/description note pairs.",
    },

    // Live Overview widgets. These read the event-stream store internally, so
    // specs compose them without wiring data sources.
    overviewHeader: {
      props: z.object({}),
      slots: [],
      description: "Overview page title with a live connection indicator.",
    },
    overviewLastError: {
      props: z.object({}),
      slots: [],
      description: "Renders the last event-stream error, or nothing.",
    },
    overviewStats: {
      props: z.object({}),
      slots: [],
      description: "Six-up strip of live control-plane health metrics.",
    },
    resourcePanel: {
      props: z.object({}),
      slots: [],
      description: "CPU/memory/disk/network gauges.",
    },
    gatewayAccess: {
      props: z.object({}),
      slots: [],
      description: "API endpoint and auth-mode card.",
    },
    componentsPanel: {
      props: z.object({}),
      slots: [],
      description: "Subsystem health grid.",
    },
    eventDistributionPanel: {
      props: z.object({}),
      slots: [],
      description: "SSE event-type breakdown chart.",
    },
    connectedPeersPanel: {
      props: z.object({}),
      slots: [],
      description: "Expandable table of active gRPC/MCP/stream peers.",
    },
    eventTapePanel: {
      props: z.object({}),
      slots: [],
      description: "Rolling live event tape.",
    },
    stateProjectionPanel: {
      props: z.object({}),
      slots: [],
      description: "Latest projected state tree.",
    },
    rawStatsPanel: {
      props: z.object({}),
      slots: [],
      description: "Raw system_stats payload viewer.",
    },

    // ────────────────────────── data primitives ──────────────────────
    container: {
      props: z.object({}),
      slots: ["default"],
      description: "Vertical stack of children.",
    },
    card: {
      props: z.object({
        title: z.string().nullable(),
        tone: tone.nullable(),
      }),
      slots: ["default"],
      description: "Bordered group used by generated JSON/schema trees.",
    },
    kv: {
      props: z.object({
        label: z.string(),
        value: z.unknown(),
        kind: z.string().nullable(),
      }),
      slots: [],
      description: "Monospace label/value row, colour-coded by kind.",
    },
    heading: {
      props: z.object({
        text: z.string(),
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
      }),
      slots: [],
      description: "Section heading.",
    },
    text: {
      props: z.object({ text: z.string() }),
      slots: [],
      description: "Monospace body text.",
    },
    badge: {
      props: z.object({
        text: z.string(),
        tone: z.enum(["default", "ok", "warn", "danger", "info"]).nullable(),
      }),
      slots: [],
      description: "Outlined tag.",
    },
    row: {
      props: z.object({}),
      slots: ["default"],
      description: "Horizontal wrapping row.",
    },
    code: {
      props: z.object({ content: z.string() }),
      slots: [],
      description: "Preformatted code block.",
    },
  },

  actions: {
    navigate: {
      params: z.object({ route: z.string() }),
      description: "Navigate the router to a route path.",
    },
    toggleState: {
      params: z.object({ statePath: z.string() }),
      description:
        "Invert the boolean at a JSON Pointer state path (sidebar and section collapse).",
    },
  },
});

export type AppCatalog = typeof appCatalog;

/** Every component name the catalog allows — useful for spec tests. */
export const CATALOG_COMPONENTS = appCatalog.componentNames;
/** Every action name the catalog allows. */
export const CATALOG_ACTIONS = appCatalog.actionNames;
