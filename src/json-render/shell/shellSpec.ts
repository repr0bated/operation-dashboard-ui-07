/**
 * Base shell spec.
 *
 * Describes the permanent chrome as JSON: the app shell wrapper and a
 * `contentRegion` element whose children are supplied at render time from
 * the provider's slot registry (default slot name: `content`).
 *
 * The actual top header + sidebar chrome are still rendered by `AppShell`
 * (which owns theme toggles, live health pill, collapsible sidebar state).
 * This spec is scoped to the *main scrollable region* so page specs can slot
 * cleanly into it without having to redeclare the outer shell.
 */
import type { Spec } from "@json-render/core";

export const shellSpec: Spec = {
  root: "shell",
  elements: {
    shell: {
      type: "appShell",
      props: {},
      children: ["main"],
    },
    main: {
      type: "contentRegion",
      props: { slot: "content" },
      children: [],
    },
  },
};

/** Canonical slot name for the shell's main content region. */
export const CONTENT_SLOT = "content";
