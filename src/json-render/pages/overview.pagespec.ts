import type { Spec } from "@json-render/core";

export const overviewSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-6" },
      children: ["overview-header", "overview-health", "overview-banner", "stats-row", "stream-live"],
    },
    "overview-header": {
      type: "pageHeader",
      props: {
        title: "Overview",
        subtitle: "System status and live StateSync objects",
      },
    },
    "overview-health": {
      type: "row",
      props: { className: null },
      children: ["overview-health-pill"],
    },
    "overview-health-pill": {
      type: "healthPill",
      props: { label: "StateSync", okText: "Connected", offlineText: "Disconnected" },
    },
    "overview-banner": {
      type: "statusBanner",
      props: {
        title: "Event stream",
        message: {
          $cond: { $state: "/connected" },
          $then: null,
          $else: "Disconnected from StateSync",
        },
        tone: "warn",
      },
    },
    "stats-row": {
      type: "grid",
      props: { cols: 4, gap: 16, className: null },
      children: ["stat-plugins", "stat-events", "stat-uptime", "stat-blobs"],
    },
    "stat-plugins": {
      type: "statCard",
      props: { label: "Plugins", value: "66", sub: "sealed", tone: "default" },
    },
    "stat-events": {
      type: "stateValue",
      props: { path: "blockchain.event_count", label: "Events", format: "raw" },
    },
    "stat-uptime": {
      type: "stateValue",
      props: { path: "procfs.uptime", label: "Uptime", format: "duration" },
    },
    "stat-blobs": {
      type: "stateValue",
      props: { path: "full_system.blob_count", label: "Blobs", format: "raw" },
    },
    "stream-live": {
      type: "card",
      props: {
        title: "Live stream objects",
        subtitle: "Every sealed plugin on the event stream",
        tone: null,
        className: null,
      },
      children: ["stream-grid-overview"],
    },
    "stream-grid-overview": {
      type: "streamGrid",
      props: { className: null },
      on: { select: { action: "selectPlugin", params: { pluginId: { $state: "/shell/selectedPlugin" } } } },
    },
  },
};
