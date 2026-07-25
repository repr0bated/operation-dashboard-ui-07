/**
 * Overview page — first JSON-rendered page in the shell.
 *
 * Uses the dashboard catalog exclusively. All live state is pulled from
 * `useEventStore` inside each widget, so this spec is fully declarative.
 */
import type { Spec } from "@json-render/core";

export const overviewSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: {},
      children: [
        "header",
        "lastError",
        "stats",
        "row2",
        "row3",
        "peers",
        "row4",
        "row5",
      ],
    },
    header: { type: "overviewHeader", props: {} },
    lastError: { type: "overviewLastError", props: {} },
    stats: { type: "overviewStats", props: {} },

    row2: {
      type: "grid",
      props: { cols: 3, gap: 4, className: "grid-cols-1 lg:grid-cols-3" },
      children: ["resources", "gateway"],
    },
    resources: { type: "resourcePanel", props: {} },
    gateway: { type: "gatewayAccess", props: {} },

    row3: {
      type: "grid",
      props: { cols: 2, gap: 4, className: "grid-cols-1 lg:grid-cols-2" },
      children: ["components", "eventDist"],
    },
    components: { type: "componentsPanel", props: {} },
    eventDist: { type: "eventDistributionPanel", props: {} },

    peers: { type: "connectedPeersPanel", props: {} },

    row4: {
      type: "grid",
      props: { cols: 2, gap: 4, className: "grid-cols-1 lg:grid-cols-2" },
      children: ["eventTape", "stateProjection"],
    },
    eventTape: { type: "eventTapePanel", props: {} },
    stateProjection: { type: "stateProjectionPanel", props: {} },

    row5: {
      type: "grid",
      props: { cols: 2, gap: 4, className: "grid-cols-1 lg:grid-cols-2" },
      children: ["rawStats", "notes"],
    },
    rawStats: { type: "rawStatsPanel", props: {} },
    notes: {
      type: "notesPanel",
      props: {
        title: "Notes",
        subtitle: "Quick reminders for control plane setups.",
        notes: [
          { title: "WireGuard tunnel", desc: "All API access goes through the WireGuard mesh. No external exposure needed." },
          { title: "Session hygiene", desc: "Use /new or session patch to reset context between agent runs." },
          { title: "Schema-first tools", desc: "Every tool exposes input_schema. Execution forms are generated from schema." },
          { title: "Event stream", desc: "SSE stream at /api/events provides real-time health, logs, and state updates." },
        ],
      },
    },
  },
};
