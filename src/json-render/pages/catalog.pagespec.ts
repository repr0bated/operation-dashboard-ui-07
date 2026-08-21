import type { Spec } from "@json-render/core";

export const catalogSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-4" },
      children: ["catalog-header", "catalog-index", "catalog-live"],
    },
    "catalog-header": {
      type: "pageHeader",
      props: {
        title: "Catalog",
        subtitle: "Registered json-render UI objects for every StateSync stream plugin",
      },
    },
    "catalog-index": {
      type: "catalogIndex",
      props: { className: null },
    },
    "catalog-live": {
      type: "card",
      props: { title: "Live stream objects", subtitle: null, tone: null, className: null },
      children: ["catalog-stream-grid"],
    },
    "catalog-stream-grid": {
      type: "streamGrid",
      props: { className: null },
      on: { select: { action: "selectPlugin", params: { pluginId: { $state: "/shell/selectedPlugin" } } } },
    },
  },
};
