import type { Spec } from "@json-render/core";

export const agentsSpec: Spec = {
  root: "agents-page",
  elements: {
    "agents-page": {
      type: "cognitiveAgentsPage",
      props: {
        title: "Agents",
        subtitle: "Cognitive agents, runtime state, tool exposure, and prewarming.",
      },
    },
  },
};
