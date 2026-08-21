import type { Spec } from "@json-render/core";

export const pluginsSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-4" },
      children: ["plugins-header", "stream-grid"],
    },
    "plugins-header": {
      type: "pageHeader",
      props: {
        title: "Event stream",
        subtitle: "StateSync objects — select one to open its ui_projection page",
      },
    },
    "stream-grid": {
      type: "streamGrid",
      props: { className: null },
      on: { select: { action: "selectPlugin", params: { pluginId: { $state: "/shell/selectedPlugin" } } } },
    },
  },
};
