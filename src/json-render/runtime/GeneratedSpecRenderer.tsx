import { useLayoutEffect, useRef, useState } from "react";
import { createStateStore, type Spec, type StateModel, type StateStore } from "@json-render/core";
import {
  Renderer,
  StateProvider,
  VisibilityProvider,
  type ComponentRenderer,
  type ComponentRegistry,
} from "@json-render/react";
import { ActionsBridge } from "./JsonRenderProvider";
import { uiStore } from "@/json-render/store/ui-store";

const AUTHORITATIVE_HOST_ROOTS = [
  "plugins",
  "schemas",
  "schemaHashes",
  "pluginIndex",
  "connected",
  "catalogHash",
  "streams",
  "shell",
] as const;
const authoritativeHostRoots = new Set<string>(AUTHORITATIVE_HOST_ROOTS);

interface GeneratedSpecRendererProps {
  spec: Spec;
  registry: ComponentRegistry;
  loading?: boolean;
}

const UnsupportedGeneratedElement: ComponentRenderer = ({ element }) => (
  <div
    role="alert"
    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
  >
    Unsupported generated component: <strong>{element.type}</strong>. This element was not rendered.
  </div>
);

function asState(value: Spec["state"]): StateModel {
  return value && typeof value === "object" ? value : {};
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.prototype.hasOwnProperty.call(right, key) && equal(left[key], right[key]),
      )
    );
  }
  return false;
}

function pointerToken(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

function firstPointerToken(path: string): string | null {
  if (!path.startsWith("/")) return null;
  const token = path.slice(1).split("/", 1)[0];
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function isAuthoritativeHostPath(path: string): boolean {
  const root = firstPointerToken(path);
  return root !== null && authoritativeHostRoots.has(root);
}

function localSeed(state: StateModel): StateModel {
  const seed = clone(state);
  for (const root of AUTHORITATIVE_HOST_ROOTS) delete seed[root];
  return seed;
}

function hostRootsSnapshot(): StateModel {
  return Object.fromEntries(
    AUTHORITATIVE_HOST_ROOTS.map((root) => [root, uiStore.get(`/${pointerToken(root)}`)]),
  );
}

/**
 * A read-through store: ordinary paths are private to this generated spec,
 * while StateSync-owned roots always come from the live dashboard store.
 */
function createGeneratedOverlayStore(initialState: StateModel): StateStore {
  const localStore = createStateStore(localSeed(initialState));
  const listeners = new Set<() => void>();
  let localSnapshot = localStore.getSnapshot();
  let hostSnapshot = hostRootsSnapshot();
  let snapshot: StateModel = { ...localSnapshot, ...hostSnapshot };
  let unsubscribeLocal: (() => void) | null = null;
  let unsubscribeHost: (() => void) | null = null;

  const refresh = () => {
    const nextLocal = localStore.getSnapshot();
    const nextHost = hostRootsSnapshot();
    const hostChanged = AUTHORITATIVE_HOST_ROOTS.some(
      (root) => !Object.is(hostSnapshot[root], nextHost[root]),
    );
    if (nextLocal === localSnapshot && !hostChanged) return;
    localSnapshot = nextLocal;
    hostSnapshot = nextHost;
    snapshot = { ...localSnapshot, ...hostSnapshot };
    for (const listener of listeners) listener();
  };

  const connect = () => {
    if (unsubscribeLocal) return;
    unsubscribeLocal = localStore.subscribe(refresh);
    unsubscribeHost = uiStore.subscribe(refresh);
    refresh();
  };

  const disconnect = () => {
    unsubscribeLocal?.();
    unsubscribeHost?.();
    unsubscribeLocal = null;
    unsubscribeHost = null;
  };

  return {
    get(path) {
      return isAuthoritativeHostPath(path) ? uiStore.get(path) : localStore.get(path);
    },
    set(path, value) {
      if (isAuthoritativeHostPath(path)) return;
      localStore.set(path, value);
    },
    update(updates) {
      const localUpdates = Object.fromEntries(
        Object.entries(updates).filter(([path]) => !isAuthoritativeHostPath(path)),
      );
      if (Object.keys(localUpdates).length > 0) localStore.update(localUpdates);
    },
    getSnapshot() {
      return snapshot;
    },
    getServerSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) connect();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) disconnect();
      };
    },
  };
}

/**
 * Diff only the state supplied by consecutive specs. This lets new streamed
 * state patches land without resetting unrelated values changed by actions.
 */
function collectSpecStateUpdates(
  previous: unknown,
  next: unknown,
  path: string,
  updates: Record<string, unknown>,
): void {
  if (equal(previous, next)) return;

  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    if (path && Object.keys(next).length === 0) {
      updates[path] = {};
      return;
    }
    for (const key of keys) {
      const childPath = `${path}/${pointerToken(key)}`;
      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        updates[childPath] = undefined;
      } else if (!Object.prototype.hasOwnProperty.call(previous, key)) {
        updates[childPath] = clone(next[key]);
      } else {
        collectSpecStateUpdates(previous[key], next[key], childPath, updates);
      }
    }
    return;
  }

  if (path) updates[path] = clone(next);
}

/**
 * Renders model-produced specs against their own persistent state store.
 * The boundary deliberately shadows the dashboard StateProvider so generated
 * `/state` never leaks into the authoritative StateSync-backed uiStore.
 */
export function GeneratedSpecRenderer({ spec, registry, loading }: GeneratedSpecRendererProps) {
  const [store] = useState(() => createGeneratedOverlayStore(asState(spec.state)));
  const previousSpecState = useRef(clone(asState(spec.state)));

  useLayoutEffect(() => {
    const nextState = asState(spec.state);
    const updates: Record<string, unknown> = {};
    collectSpecStateUpdates(previousSpecState.current, nextState, "", updates);
    previousSpecState.current = clone(nextState);
    if (Object.keys(updates).length > 0) store.update(updates);
    // SpecStream compiler snapshots are shallow: `spec` changes on every patch,
    // while its nested `state` object may be mutated and retain its identity.
  }, [spec, store]);

  return (
    <StateProvider store={store}>
      <VisibilityProvider>
        <ActionsBridge>
          <Renderer
            spec={spec}
            registry={registry}
            loading={loading}
            fallback={UnsupportedGeneratedElement}
          />
        </ActionsBridge>
      </VisibilityProvider>
    </StateProvider>
  );
}
