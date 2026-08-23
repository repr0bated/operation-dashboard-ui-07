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
import { agentsSpec } from "./agents.pagespec";
import { tchedRouterConfigSpec } from "./tched-router-config.pagespec";
import { REFERENCE_MOCK_SPECS } from "./reference-mocks.pagespec";

/** Route path → page spec. Hand-written specs win over reference mocks. */
export const PAGE_SPECS: Record<string, Spec> = {
  ...REFERENCE_MOCK_SPECS,
  // `/` is the chat-only surface (routed in App.tsx, outside the shell), so
  // Overview is reached at `/overview`. Both keys are kept so a bookmarked
  // `/` inside the shell still resolves rather than 404ing.
  "/": overviewSpec,
  "/overview": overviewSpec,
  "/catalog": catalogSpec,
  "/gallery": gallerySpec,
  "/generate": generateSpec,
  "/plugins": pluginsSpec,
  "/network": networkSpec,
  "/agents": agentsSpec,
  "/tched-router/config": tchedRouterConfigSpec,
  // Antigravity chat alone. `/chat` is a NAV_MANIFEST alias of
  // `/antigravity/chat`, so it has to resolve to the same spec.
  "/antigravity/chat": antigravitySpec,
  "/antigravity": antigravitySpec,
  "/chat": antigravitySpec,
  "/accountability": chatSpec,
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
  agentsSpec,
  tchedRouterConfigSpec,
  REFERENCE_MOCK_SPECS,
};
