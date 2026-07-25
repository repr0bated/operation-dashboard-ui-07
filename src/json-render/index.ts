/**
 * Public entry for the JSON Render base.
 *
 * Import shape:
 *   import { JsonRenderProvider, baseRegistry, NAV_MANIFEST, overviewSpec } from "@/json-render";
 */
export { baseRegistry, shellCatalog, dashboardCatalog } from "./catalog";
export { JsonRenderProvider, useJsonRender, useSlot } from "./runtime/JsonRenderProvider";
export { PageSpecOutlet, pageSpecs } from "./runtime/PageSpecOutlet";
export { SpecPage } from "./runtime/SpecPage";

export { ShellRenderer } from "./shell/ShellRenderer";
export { shellSpec, CONTENT_SLOT } from "./shell/shellSpec";
export { overviewSpec } from "./pages/overview.pagespec";
export {
  NAV_MANIFEST,
  SECTION_ORDER,
  buildNavGroups,
  type NavItem,
  type NavGroup,
  type NavSection,
} from "./navigation/manifest";
export {
  ALLOW_ALL,
  hasCapability,
  hasAll,
  type Capability,
  type CapabilitySet,
} from "./navigation/capabilities";
export { resolveIcon, iconRegistry } from "./navigation/icons";
