import type { StateChange } from "@/grpc/gen/operation";
import { StateFrameKind } from "@/grpc/gen/operation";
import { valueToJs } from "@/grpc/google/protobuf/struct";

export interface StateEntry {
  key: string;
  value: unknown;
}

export function isStateHeartbeat(frame: StateChange): boolean {
  return frame.frameKind === StateFrameKind.HEARTBEAT;
}

/**
 * Turn a StateSync frame into store entries.
 *
 * Initial frames and whole-plugin live updates have an empty member name. They
 * seed both the plugin root and `plugin.field` entries so pages can subscribe
 * to individual fields without reparsing one large aggregate object.
 */
export function stateEntries(frame: StateChange): StateEntry[] {
  if (isStateHeartbeat(frame) || !frame.pluginId || !frame.newValue) return [];

  const value = valueToJs(frame.newValue);
  if (frame.memberName) {
    return [{ key: `${frame.pluginId}.${frame.memberName}`, value }];
  }

  const entries: StateEntry[] = [{ key: frame.pluginId, value }];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      entries.push({ key: `${frame.pluginId}.${field}`, value: fieldValue });
    }
  }
  return entries;
}
