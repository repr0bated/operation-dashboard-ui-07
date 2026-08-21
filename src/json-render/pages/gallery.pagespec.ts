import type { Spec } from "@json-render/core";

export const gallerySpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-4" },
      children: ["gallery-header", "gallery-body"],
    },
    "gallery-header": {
      type: "pageHeader",
      props: {
        title: "Gallery",
        subtitle: "Every catalog component rendered with mock props that satisfy its Zod schema",
      },
    },
    "gallery-body": {
      type: "catalogGallery",
      props: { className: null },
    },
  },
};
