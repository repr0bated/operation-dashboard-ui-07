import { pluginService } from "@/grpc/client";
import { jsObjectToValue, structToObject, valueToJs } from "@/grpc/google/protobuf/struct";
import {
  flattenLeaves,
  isMaskedSecret,
  liftNamedMaps,
  lookupSectionValue,
  parseConfigList,
  type SchemaNode,
} from "./config-schema";

const PLUGIN_ID = "tched_router";
const OBJECT_PATH = "/org/opdbus/v1/plugins/tched_router";
const INTERFACE = "org.opdbus.v1.PluginV1";
const ACTOR = "operation-dashboard-ui";
const READ_CAP = "cap.software.tched-router.router.read@v1";
const WRITE_CAP = "tched-router.write";

const SNAPSHOT_URL = "/tched-router-live-config.json";

export async function loadConfig(): Promise<Record<string, unknown>> {
  try {
    return await loadConfigViaPlugin();
  } catch (error) {
    const snapshot = await loadConfigSnapshot();
    if (snapshot) return snapshot;
    throw error;
  }
}

async function loadConfigViaPlugin(): Promise<Record<string, unknown>> {
  const result = await callConfig("config_list", {}, READ_CAP);
  const message = typeof result.message === "string" ? result.message : "";
  if (message) return parseConfigList(message);
  if (result.config && typeof result.config === "object" && !Array.isArray(result.config)) {
    return liftNamedMaps(result.config as Record<string, unknown>);
  }
  return liftNamedMaps(result);
}

async function loadConfigSnapshot(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? liftNamedMaps(payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function patchConfig(ops: Array<Record<string, unknown>>): Promise<void> {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error("config patch requires an operations array of rfc 6902 ops");
  }
  const resp = await pluginService.callMethod({
    pluginId: PLUGIN_ID,
    objectPath: OBJECT_PATH,
    interfaceName: INTERFACE,
    methodName: "config_patch",
    arguments: [jsObjectToValue({ operations: ops })],
    actorId: ACTOR,
    capabilityId: WRITE_CAP,
  });
  if (resp.success === false) {
    throw new Error(resp.error?.message || "config_patch failed");
  }
  const envelope = structToObject(resp.result as Record<string, unknown>);
  if (envelope.success === false) {
    const err = envelope.error;
    const message =
      typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : "config_patch failed";
    throw new Error(message);
  }
}

export async function replacePointer(path: string, value: unknown): Promise<void> {
  await patchConfig([{ op: "add", path, value }]);
}

export async function saveSection(
  schemaKey: string,
  draft: unknown,
  liveConfig: Record<string, unknown>,
): Promise<void> {
  const existing = lookupSectionValue(liveConfig, schemaKey);
  const nextLeaves = flattenLeaves(draft, schemaKey);
  const prevLeaves = new Map(
    flattenLeaves(existing, schemaKey).map((leaf) => [leaf.path, leaf.value]),
  );
  const writes = nextLeaves.filter((leaf) => {
    if (isMaskedSecret(leaf.value)) return false;
    return !Object.is(leaf.value, prevLeaves.get(leaf.path));
  });
  if (writes.length === 0) return;
  for (const leaf of writes) {
    if (!leaf.path) {
      throw new Error("config_set requires a nonempty string path");
    }
    await callConfig(
      "config_set",
      {
        path: leaf.path,
        value: stringifyConfigValue(leaf.value),
        no_interactive: "true",
      },
      WRITE_CAP,
    );
  }
}

export function asRootSchema(value: unknown): SchemaNode {
  if (!value || typeof value !== "object") {
    throw new Error("tched-router config schema is missing");
  }
  return value as SchemaNode;
}

async function callConfig(
  methodName: string,
  options: Record<string, string>,
  capabilityId: string,
): Promise<Record<string, unknown>> {
  const resp = await pluginService.callMethod({
    pluginId: PLUGIN_ID,
    objectPath: OBJECT_PATH,
    interfaceName: INTERFACE,
    methodName,
    arguments: [
      jsObjectToValue({
        path: options.path ?? "",
        value: options.value ?? "",
        no_interactive: options.no_interactive ?? "",
        options,
      }),
    ],
    actorId: ACTOR,
    capabilityId,
  });
  if (resp.success === false) {
    throw new Error(resp.error?.message || `${methodName} failed`);
  }
  const envelope = structToObject(resp.result as Record<string, unknown>);
  if (envelope.success === false) {
    const err = envelope.error;
    const message =
      typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : `${methodName} failed`;
    throw new Error(message);
  }
  const inner = valueToJs(envelope.result);
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return envelope;
}

function stringifyConfigValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
