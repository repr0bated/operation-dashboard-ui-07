/**
 * Plugin methods facade — thin ergonomic layer over the auto-generated
 * per-method service clients in `src/grpc/gen/plugin_methods/`.
 *
 * Every plugin RPC (get_ui_spec, set_model, list_tags, …) is registered in
 * `PLUGIN_METHOD_ENTRIES` keyed by both its `subid` (obs.service.gemma.ui-spec.get@v1)
 * and its fully-qualified type name (operation.method.gemma_brain.get_ui_spec.GetUiSpecService/get_ui_spec).
 *
 * UI code should prefer `pluginMethods.callSubid(subid, input)` for anything
 * driven by discovery, or the direct helpers for known-at-compile-time RPCs.
 */
import type {
  MethodInfo,
  RpcOptions,
  RpcTransport,
  UnaryCall,
} from "@protobuf-ts/runtime-rpc";
import { getTransport } from "./client";
import {
  PLUGIN_METHOD_ENTRIES,
  PLUGIN_METHOD_BY_SUBID,
  PLUGIN_METHOD_BY_TYPENAME,
  PLUGIN_METHOD_BY_PLUGIN,
  type PluginMethodEntry,
} from "./gen/plugin-methods-index";

export type { PluginMethodEntry };
export { PLUGIN_METHOD_ENTRIES, PLUGIN_METHOD_BY_SUBID, PLUGIN_METHOD_BY_PLUGIN };

/**
 * The bridge does NOT serve the per-method `operation.method.<plugin>.<rpc>.<Rpc>Service`
 * routes the generated clients derive their URL from — reflection advertises those
 * descriptors, but every handler lives on one aggregate service per plugin:
 *   operation.plugin.v1.<Plugin>PluginMethods/<Rpc>
 * so we rewrite the service typeName on the way out.
 */
export function aggregateServiceName(plugin: string): string {
  const pascal = plugin
    .split("_")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return `operation.plugin.v1.${pascal}PluginMethods`;
}

function reroute(method: MethodInfo, plugin: string): MethodInfo {
  return {
    ...method,
    service: { ...method.service, typeName: aggregateServiceName(plugin) },
  } as MethodInfo;
}

function routedTransport(plugin: string): RpcTransport {
  const base = getTransport();
  return {
    mergeOptions: (options) => base.mergeOptions(options),
    unary: (m, i, o) => base.unary(reroute(m, plugin), i, o),
    serverStreaming: (m, i, o) => base.serverStreaming(reroute(m, plugin), i, o),
    clientStreaming: (m) => base.clientStreaming(reroute(m, plugin)),
    duplex: (m) => base.duplex(reroute(m, plugin)),

  } as RpcTransport;
}

async function runUnary<TOut extends object>(call: UnaryCall<object, TOut>): Promise<TOut> {
  const { response } = await call;
  return response;
}


export const pluginMethods = {
  /** All registered entries (sorted by file). */
  list(): readonly PluginMethodEntry[] {
    return PLUGIN_METHOD_ENTRIES;
  },

  /** All entries for a plugin (e.g. "gemma_brain", "zeroclaw"). */
  forPlugin(plugin: string): readonly PluginMethodEntry[] {
    return PLUGIN_METHOD_BY_PLUGIN.get(plugin) ?? [];
  },

  /** Get a single entry by its OSCAL subid, e.g. "obs.service.gemma.ui-spec.get@v1". */
  getBySubid(subid: string): PluginMethodEntry | undefined {
    return PLUGIN_METHOD_BY_SUBID.get(subid);
  },

  /**
   * Get an entry by its fully-qualified `<service typeName>/<rpc method>`,
   * e.g. "operation.method.gemma_brain.get_ui_spec.GetUiSpecService/get_ui_spec".
   */
  getByTypeName(key: string): PluginMethodEntry | undefined {
    return PLUGIN_METHOD_BY_TYPENAME.get(key);
  },

  /** Invoke a plugin method by subid. Throws if the subid is unknown. */
  async callSubid<TIn extends object = object, TOut extends object = Record<string, unknown>>(
    subid: string,
    input: TIn,
    options?: RpcOptions,
  ): Promise<TOut> {
    const entry = PLUGIN_METHOD_BY_SUBID.get(subid);
    if (!entry) throw new Error(`plugin method not found for subid: ${subid}`);
    return runUnary(
      entry.invoke(routedTransport(entry.plugin), input, options) as UnaryCall<object, TOut>,
    );

  },

  /** Invoke a plugin method by `<serviceTypeName>/<rpcMethod>`. */
  async callTypeName<TIn extends object = object, TOut extends object = Record<string, unknown>>(
    key: string,
    input: TIn,
    options?: RpcOptions,
  ): Promise<TOut> {
    const entry = PLUGIN_METHOD_BY_TYPENAME.get(key);
    if (!entry) throw new Error(`plugin method not found: ${key}`);
    return runUnary(entry.invoke(getTransport(), input, options) as UnaryCall<object, TOut>);
  },
};
