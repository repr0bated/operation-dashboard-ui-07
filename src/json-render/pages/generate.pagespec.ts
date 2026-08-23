import type { Spec } from "@json-render/core";

export const generateSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-4 h-full min-h-0" },
      children: ["header", "studio"],
    },
    header: {
      type: "pageHeader",
      props: {
        title: "Generate",
        subtitle:
          "Model streams a Zod tile object. The client maps it onto catalog tiles and autotile packs them.",
      },
    },
    studio: {
      type: "generateStudio",
      props: { className: "flex-1 min-h-0" },
    },
  },
};
