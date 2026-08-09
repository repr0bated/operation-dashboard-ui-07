/**
 * JsonRenderProvider — the trusted runtime for every spec in the app.
 *
 * Wires the three json-render providers around the catalog registry:
 *   StateProvider      → the shell state model (route, collapse flags)
 *   VisibilityProvider → evaluates `visible` conditions on elements
 *   ActionProvider     → executes `on: { press: { action: ... } }` bindings
 *
 * It also keeps `/shell/route` and `/shell/activeSection` in sync with the
 * router, which is what makes nav highlighting and section auto-open work
 * declaratively from the spec.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  StateProvider,
  VisibilityProvider,
  ActionProvider,
  useStateStore,
  type SetState,
} from "@json-render/react";
import type { ComponentRegistry } from "@json-render/react";
import { registry as baseRegistry, handlers as createHandlers } from "@/json-render/catalog/registry";
import { ALLOW_ALL, type CapabilitySet } from "@/json-render/navigation/capabilities";
import {
  NAV_MANIFEST,
  buildNavGroups,
  activeSectionSlug,
  type NavGroup,
  type NavItem,
} from "@/json-render/navigation/manifest";
import { SHELL_STATE, shellInitialState } from "@/json-render/shell/shellSpec";
import { SlotProvider } from "./slots";
import { RouterBridge } from "./navigation-bridge";

export interface JsonRenderContextValue {
  registry: ComponentRegistry;
  capabilities: CapabilitySet;
  manifest: NavItem[];
  navGroups: NavGroup[];
}

const JsonRenderContext = createContext<JsonRenderContextValue | null>(null);

export interface JsonRenderProviderProps {
  children: ReactNode;
  registry?: ComponentRegistry;
  capabilities?: CapabilitySet;
  manifest?: NavItem[];
  slots?: Record<string, ReactNode>;
}

/**
 * Mirrors the router into the shell state model. Runs inside StateProvider so
 * it can write through the store.
 */
function RouteStateSync({ manifest }: { manifest: NavItem[] }) {
  const { pathname } = useLocation();
  const { update } = useStateStore();
  useEffect(() => {
    update({
      [SHELL_STATE.route]: pathname,
      [SHELL_STATE.activeSection]: activeSectionSlug(pathname, manifest),
    });
  }, [pathname, manifest, update]);
  return null;
}

/** Builds ActionProvider handlers bound to the live state store. */
function ActionsBridge({ children }: { children: ReactNode }) {
  const { getSnapshot, update } = useStateStore();

  // Handlers are created once; they read the latest state through refs.
  const snapshotRef = useRef(getSnapshot);
  const updateRef = useRef(update);
  snapshotRef.current = getSnapshot;
  updateRef.current = update;

  const setState = useRef<SetState>((updater) => {
    const prev = snapshotRef.current();
    const next = updater(prev);
    // Top-level keys only; the shell model has a single `shell` root key.
    updateRef.current(
      Object.fromEntries(Object.keys(next).map((k) => [`/${k}`, next[k]])),
    );
  });

  const handlers = useMemo(
    () =>
      createHandlers(
        () => setState.current,
        () => snapshotRef.current(),
      ),
    [],
  );

  return <ActionProvider handlers={handlers}>{children}</ActionProvider>;
}

export function JsonRenderProvider({
  children,
  registry = baseRegistry,
  capabilities = ALLOW_ALL,
  manifest = NAV_MANIFEST,
  slots = {},
}: JsonRenderProviderProps) {
  const { pathname } = useLocation();
  // Captured once on mount: this seeds the store. RouteStateSync owns every
  // subsequent route change, so re-deriving it on navigation would reset the
  // user's sidebar/section collapse state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialState = useMemo(() => shellInitialState(pathname), []);

  const value = useMemo<JsonRenderContextValue>(
    () => ({
      registry,
      capabilities,
      manifest,
      navGroups: buildNavGroups(manifest, capabilities),
    }),
    [registry, capabilities, manifest],
  );

  return (
    <JsonRenderContext.Provider value={value}>
      <StateProvider initialState={initialState}>
        <RouterBridge />
        <RouteStateSync manifest={manifest} />
        <VisibilityProvider>
          <ActionsBridge>
            <SlotProvider slots={slots}>{children}</SlotProvider>
          </ActionsBridge>
        </VisibilityProvider>
      </StateProvider>
    </JsonRenderContext.Provider>
  );
}

export function useJsonRender(): JsonRenderContextValue {
  const ctx = useContext(JsonRenderContext);
  if (!ctx) throw new Error("useJsonRender must be used inside <JsonRenderProvider>");
  return ctx;
}
