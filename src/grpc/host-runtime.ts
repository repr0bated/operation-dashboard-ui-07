/**
 * Host runtime reads via the `host_runtime` plugin.
 *
 * Wire path: `operation.v1.PluginService/CallMethod` →
 * `operation.plugin.v1.HostRuntimePluginMethods/<Rpc>` once the plugin index
 * is regenerated; until then this module uses CallMethod directly.
 */
import { pluginService } from "./client";
import { jsObjectToValue, structToObject, valueToJs } from "./google/protobuf/struct";

const PLUGIN_ID = "host_runtime";
const OBJECT_PATH = "/org/opdbus/v1/plugins/host_runtime";
const INTERFACE = "org.opdbus.v1.PluginV1";
const CAPABILITY = "host_runtime.read";
const ACTOR = "operation-dashboard-ui";

async function callHostRuntime<T extends Record<string, unknown>>(
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const resp = await pluginService.callMethod({
    pluginId: PLUGIN_ID,
    objectPath: OBJECT_PATH,
    interfaceName: INTERFACE,
    methodName,
    arguments: [jsObjectToValue(args)],
    actorId: ACTOR,
    capabilityId: CAPABILITY,
  });

  const envelope = structToObject(resp.result as Record<string, unknown>);
  if (envelope.success === false) {
    const err = envelope.error;
    const message =
      typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : "host_runtime call failed";
    throw new Error(message);
  }

  const inner = valueToJs(envelope.result);
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as T;
  }
  return envelope as T;
}

export const hostRuntime = {
  getSystemInfo: () => callHostRuntime("get_system_info"),
  listServices: (stateFilter = "") =>
    callHostRuntime("list_services", { state_filter: stateFilter }),
  getService: (serviceName: string) =>
    callHostRuntime("get_service", { service_name: serviceName }),
  listInterfaces: () => callHostRuntime("list_interfaces"),
  getNumaTopology: () => callHostRuntime("get_numa_topology"),
  checkUnixSockets: (paths: string[]) =>
    callHostRuntime("check_unix_sockets", { paths }),
  sampleMetrics: (input: {
    previousCpuIdle?: number;
    previousCpuTotal?: number;
    previousRx?: number;
    previousTx?: number;
  } = {}) =>
    callHostRuntime("sample_metrics", {
      previous_cpu_idle: input.previousCpuIdle ?? null,
      previous_cpu_total: input.previousCpuTotal ?? null,
      previous_rx: input.previousRx ?? null,
      previous_tx: input.previousTx ?? null,
    }),
};
