import type { Spec } from "@json-render/core";

export const tchedRouterConfigSpec: Spec = {
  root: "tched-router-config-page",
  elements: {
    "tched-router-config-page": {
      type: "tchedRouterConfig",
      props: {
        title: "3tched Router Config",
        subtitle: "Typed settings from zeroclaw config schema · plugin tched_router",
      },
    },
  },
};
