/**
 * Page-spec registry.
 *
 * Add a screen: NAV_MANIFEST entry + a route here. No JSX, no <Route>.
 */
import type { Spec } from "@json-render/core";
import { overviewSpec } from "./overview.pagespec";
import { catalogSpec } from "./catalog.pagespec";
import { gallerySpec } from "./gallery.pagespec";
import { pluginsSpec } from "./plugins.pagespec";
import { networkSpec } from "./network.pagespec";
import { chatSpec } from "./chat.pagespec";
import { antigravitySpec } from "./antigravity.pagespec";
import { accountabilitySpec } from "./accountability.pagespec";
import { generateSpec } from "./generate.pagespec";

/** Route path → page spec. */
export const PAGE_SPECS: Record<string, Spec> = {
  "/": overviewSpec,
  "/catalog": catalogSpec,
  "/gallery": gallerySpec,
  "/generate": generateSpec,
  "/plugins": pluginsSpec,
  "/network": networkSpec,
  // Antigravity chat alone. `/chat` is a NAV_MANIFEST alias of
  // `/antigravity/chat`, so it has to resolve to the same spec.
  "/antigravity/chat": antigravitySpec,
  "/antigravity": antigravitySpec,
  "/chat": antigravitySpec,
  "/accountability": accountabilitySpec,
  // Both panes stacked — the previous behaviour of all four routes above.
  "/antigravity/stacked": chatSpec,
};

export function pageSpecFor(route: string): Spec | undefined {
  return PAGE_SPECS[route];
}

export {
  overviewSpec,
  catalogSpec,
  gallerySpec,
  pluginsSpec,
  networkSpec,
  chatSpec,
  antigravitySpec,
  accountabilitySpec,
  generateSpec,
};
