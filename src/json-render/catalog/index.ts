/**
 * Trusted base component registry for the JSON Render app.
 *
 * Combines:
 *   • the primitive `jsonRenderRegistry` used by the existing gRPC explorer
 *     (kv/card/heading/text/badge/row/code/container)
 *   • the shell catalog (appShell/contentRegion/pageHeader/statusBanner/emptyState)
 *   • the dashboard catalog (grid/cardEl/statCard + overview widgets)
 */
import type { ComponentRegistry } from "@json-render/react";
import { jsonRenderRegistry } from "@/lib/json-render-catalog";
import { shellCatalog } from "./shell";
import { dashboardCatalog } from "./dashboard";

export const baseRegistry: ComponentRegistry = {
  ...jsonRenderRegistry,
  ...shellCatalog,
  ...dashboardCatalog,
};

export { shellCatalog, dashboardCatalog };
