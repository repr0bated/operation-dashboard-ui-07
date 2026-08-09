import { describe, expect, it } from "vitest";
import type { StateChange } from "@/grpc/gen/operation";
import { StateFrameKind } from "@/grpc/gen/operation";
import { isStateHeartbeat, stateEntries } from "@/lib/state-sync-frames";

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
});
