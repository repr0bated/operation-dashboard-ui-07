import type { StateChange } from "@/grpc/gen/operation";
import { ChangeType, StateFrameKind } from "@/grpc/gen/operation";
import { valueToJs } from "@/grpc/google/protobuf/struct";

export interface StateEntry {
  key: string;
  value: unknown;
}

export interface SchemaFrame {
  pluginId: string;
  schemaHash: string;
  /** The sealed PluginSchema JSON, exactly as it was sealed into the blob. */
  schema: unknown;
}

export function isStateHeartbeat(frame: StateChange): boolean {
  return frame.frameKind === StateFrameKind.HEARTBEAT;
}

/**
 * Does this frame carry a contract rather than a value?
 *
 * Contract frames look structurally like whole-plugin state updates — a plugin
 * id, a populated newValue, no member name — so they must be identified by
 * change type and routed away from state, or a plugin's schema would be stored
 * as if it were that plugin's state.
 */
export function isSchemaFrame(frame: StateChange): boolean {
  return frame.changeType === ChangeType.SCHEMA_MIGRATION;
}

/** Decode a contract frame, or null if this frame is not one. */
export function schemaFrame(frame: StateChange): SchemaFrame | null {
  if (!isSchemaFrame(frame) || !frame.pluginId || !frame.newValue) return null;
  return {
    pluginId: frame.pluginId,
    schemaHash: frame.schemaHash,
    schema: valueToJs(frame.newValue),
  };
}

/**
 * Turn a StateSync frame into store entries.
 *
 * Initial frames and whole-plugin live updates have an empty member name. They
 * seed both the plugin root and `plugin.field` entries so pages can subscribe
 * to individual fields without reparsing one large aggregate object.
 */
export function stateEntries(frame: StateChange): StateEntry[] {
  if (isStateHeartbeat(frame) || isSchemaFrame(frame) || !frame.pluginId || !frame.newValue) {
    return [];
  }

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
