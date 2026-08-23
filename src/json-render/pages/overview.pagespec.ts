import type { Spec } from "@json-render/core";
import { compileAutoTileSpec } from "@/json-render/spec-gen/auto-tile";

const board = compileAutoTileSpec(
  [
    { id: "overview-stats", type: "overviewStats", props: {} },
    { id: "overview-resources", type: "resourcePanel", props: {} },
    { id: "overview-gateway", type: "gatewayAccess", props: {} },
    { id: "overview-components", type: "componentsPanel", props: {} },
    { id: "overview-events", type: "eventDistributionPanel", props: {} },
    { id: "overview-peers", type: "connectedPeersPanel", props: {} },
    { id: "overview-tape", type: "eventTapePanel", props: {} },
    { id: "overview-projection", type: "stateProjectionPanel", props: {} },
    { id: "overview-raw", type: "rawStatsPanel", props: {} },
    {
      id: "overview-notes",
      type: "notesPanel",
      props: {
        title: "Notes",
        subtitle: "Quick reminders for control plane setups.",
        notes: [
          {
            title: "WireGuard tunnel",
            desc: "All API access goes through the WireGuard mesh. No external exposure needed.",
          },
          {
            title: "Session hygiene",
            desc: "Use /new or session patch to reset context between agent runs.",
          },
          {
            title: "Schema-first tools",
            desc: "Every tool exposes input_schema. Execution forms are generated from schema.",
          },
          {
            title: "Event stream",
            desc: "SSE stream at /api/events provides real-time health, logs, and state updates.",
          },
        ],
      },
    },
  ],
  { rootId: "overview-board", boardId: "overview" },
);

export const overviewSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-6" },
      children: ["overview-header", "overview-error", "overview-board"],
    },
    "overview-header": {
      type: "overviewHeader",
      props: {},
    },
    "overview-error": {
      type: "overviewLastError",
      props: {},
    },
    ...board.elements,
  },
};
