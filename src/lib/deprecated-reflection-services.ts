/**
 * Legacy mirror/passthrough/assistant gRPC services. Network Control and
 * reflection pickers hide them — callers should use the schema plugin path:
 *   operation.plugin.v1.<Plugin>PluginMethods/<Rpc>
 * (via `pluginMethods.callSubid`) or `PluginService.CallMethod`.
 *
 * Soul / namespace memory: use `@/grpc/chatbot-cognitive` (cognitive_mcp),
 * not `assistant.v1.*`.
 */
export const DEPRECATED_REFLECTION_SERVICES = new Set([
  "operation.v1.DbusPassthrough",
  "operation.v1.OvsdbMirror",
  "operation.v1.RuntimeMirror",
  "opdbus.services.v1.ServiceManager",
  "assistant.v1.SoulService",
  "assistant.v1.NamespaceMemoryService",
  "op.mcp.v1.McpService",
]);

const DEPRECATED_SUFFIXES = [
  "DbusPassthrough",
  "OvsdbMirror",
  "RuntimeMirror",
  "ServiceManager",
  "SoulService",
  "NamespaceMemoryService",
] as const;

export function isDeprecatedReflectionService(serviceName: string): boolean {
  if (DEPRECATED_REFLECTION_SERVICES.has(serviceName)) return true;
  if (serviceName.startsWith("assistant.v1.")) return true;
  return DEPRECATED_SUFFIXES.some(
    (suffix) => serviceName.endsWith(`.${suffix}`) || serviceName === suffix,
  );
}

/** Canonical served path for a plugin RPC (tonic-web URL segment). */
export function pluginRpcPath(pluginId: string, rpcName: string): string {
  const pascal = pluginId
    .split("_")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const rpc = rpcName.charAt(0).toUpperCase() + rpcName.slice(1);
  return `operation.plugin.v1.${pascal}PluginMethods/${rpc}`;
}

export const DEPRECATED_REFLECTION_HINT =
  "Use operation.plugin.v1.<Plugin>PluginMethods/<Rpc> (pluginMethods.callSubid) or PluginService.CallMethod — not mirror, passthrough, or assistant.v1 services.";
