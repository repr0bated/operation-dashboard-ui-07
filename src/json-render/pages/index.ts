/**
 * Page-spec registry.
 *
 * ── The workflow ─────────────────────────────────────────────────────────
 * To add a screen to the console:
 *   1. add one entry to `NAV_MANIFEST` (navigation/manifest.ts)
 *   2. add `route → spec` here
 * The sidebar entry and the page both appear. No JSX, no <Route>, no shell
 * edit. Omit step 2 and the route falls through to its legacy React page.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { Spec } from "@json-render/core";
import { overviewSpec } from "./overview.pagespec";
import { networkSpec } from "./network.pagespec";

/** Route path → page spec. Routes absent here render their React page. */
export const PAGE_SPECS: Record<string, Spec> = {
  "/": overviewSpec,
  "/network": networkSpec,
};

/** Lookup used by `PageSpecOutlet`. */
export function pageSpecFor(route: string): Spec | undefined {
  return PAGE_SPECS[route];
}

export { overviewSpec, networkSpec };
