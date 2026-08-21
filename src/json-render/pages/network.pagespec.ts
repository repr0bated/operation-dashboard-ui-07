import type { Spec } from "@json-render/core";

/** Named StateSync object for the sealed `net` plugin — not the old gRPC explorer. */
export const networkSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-4" },
      children: ["net-header", "net-object"],
    },
    "net-header": {
      type: "pageHeader",
      props: { title: "Network", subtitle: "Named catalog object: net" },
    },
    "net-object": {
      type: "net",
      props: { member: null, className: null },
      on: { press: { action: "selectPlugin", params: { pluginId: "net" } } },
    },
  },
};
