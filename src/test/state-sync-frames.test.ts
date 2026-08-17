import { describe, expect, it } from "vitest";
import type { StateChange } from "@/grpc/gen/operation";
import { ChangeType, StateFrameKind } from "@/grpc/gen/operation";
import {
  isSchemaFrame,
  isStateHeartbeat,
  schemaFrame,
  stateEntries,
} from "@/lib/state-sync-frames";

describe("StateSync stream framing", () => {
  it("fans an initial whole-plugin frame out into live store fields", () => {
    const frame = {
      pluginId: "incus",
      memberName: "",
      frameKind: StateFrameKind.INITIAL_STATE,
      newValue: { instances: [{ name: "netmaker" }], profiles: ["default"] },
    } as unknown as StateChange;

    expect(stateEntries(frame)).toEqual([
      { key: "incus", value: { instances: [{ name: "netmaker" }], profiles: ["default"] } },
      { key: "incus.instances", value: [{ name: "netmaker" }] },
      { key: "incus.profiles", value: ["default"] },
    ]);
  });

  it("treats heartbeat frames as transport health, not state", () => {
    const frame = { frameKind: StateFrameKind.HEARTBEAT } as StateChange;
    expect(isStateHeartbeat(frame)).toBe(true);
    expect(stateEntries(frame)).toEqual([]);
  });

  it("never folds a contract frame into state", () => {
    // A contract frame is shaped exactly like a whole-plugin update — plugin
    // id, populated newValue, no member name — so only the change type tells
    // them apart. Getting this wrong stores a plugin's schema as its state.
    const frame = {
      pluginId: "network",
      memberName: "",
      changeType: ChangeType.SCHEMA_MIGRATION,
      frameKind: StateFrameKind.INITIAL_STATE,
      schemaHash: "aaaa1111",
      newValue: { name: "network", fields: { bridges: { field_type: "array" } } },
    } as unknown as StateChange;

    expect(isSchemaFrame(frame)).toBe(true);
    expect(stateEntries(frame)).toEqual([]);
  });

  it("decodes a contract frame into its plugin, hash and sealed schema", () => {
    const frame = {
      pluginId: "network",
      memberName: "",
      changeType: ChangeType.SCHEMA_MIGRATION,
      schemaHash: "aaaa1111",
      newValue: { name: "network" },
    } as unknown as StateChange;

    expect(schemaFrame(frame)).toEqual({
      pluginId: "network",
      schemaHash: "aaaa1111",
      schema: { name: "network" },
    });
  });

  it("does not mistake an ordinary value frame for a contract", () => {
    const frame = {
      pluginId: "network",
      memberName: "bridges",
      changeType: ChangeType.PROPERTY_SET,
      schemaHash: "aaaa1111",
      newValue: ["ovsbr0"],
    } as unknown as StateChange;

    expect(isSchemaFrame(frame)).toBe(false);
    expect(schemaFrame(frame)).toBeNull();
    // The contract hash rides along on value frames; it is for drift
    // detection, not a signal that the frame carries a schema.
    expect(stateEntries(frame)).toEqual([{ key: "network.bridges", value: ["ovsbr0"] }]);
  });
});
