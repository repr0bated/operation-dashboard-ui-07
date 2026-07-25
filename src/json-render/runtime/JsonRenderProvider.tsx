/**
 * JsonRenderProvider — trusted platform context for the JSON Render base.
 *
 * Provides:
 *   • the merged component registry (shell + dashboard catalogs)
 *   • the capability set used to filter navigation and page specs
 *   • a slot registry so shell specs can render React children into named
 *     regions (e.g. the `content` slot in the shell spec)
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { JSONUIProvider, type ComponentRegistry } from "@json-render/react";
import { baseRegistry } from "@/json-render/catalog";
import { ALLOW_ALL, type CapabilitySet } from "@/json-render/navigation/capabilities";
import { NAV_MANIFEST, buildNavGroups, type NavGroup, type NavItem } from "@/json-render/navigation/manifest";

export interface JsonRenderContextValue {
  registry: ComponentRegistry;
  capabilities: CapabilitySet;
  manifest: NavItem[];
  navGroups: NavGroup[];
  slots: Record<string, ReactNode>;
}

const JsonRenderContext = createContext<JsonRenderContextValue | null>(null);

export interface JsonRenderProviderProps {
  children: ReactNode;
  registry?: ComponentRegistry;
  capabilities?: CapabilitySet;
  manifest?: NavItem[];
  slots?: Record<string, ReactNode>;
}

export function JsonRenderProvider({
  children,
  registry = baseRegistry,
  capabilities = ALLOW_ALL,
  manifest = NAV_MANIFEST,
  slots = {},
}: JsonRenderProviderProps) {
  const value = useMemo<JsonRenderContextValue>(
    () => ({
      registry,
      capabilities,
      manifest,
      navGroups: buildNavGroups(manifest, capabilities),
      slots,
    }),
    [registry, capabilities, manifest, slots],
  );
  return (
    <JsonRenderContext.Provider value={value}>
      <JSONUIProvider registry={registry}>{children}</JSONUIProvider>
    </JsonRenderContext.Provider>
  );
}

export function useJsonRender(): JsonRenderContextValue {
  const ctx = useContext(JsonRenderContext);
  if (!ctx) throw new Error("useJsonRender must be used inside <JsonRenderProvider>");
  return ctx;
}

/** Read a named slot (returns undefined if not provided by the current shell). */
export function useSlot(name: string): ReactNode {
  return useJsonRender().slots[name];
}
