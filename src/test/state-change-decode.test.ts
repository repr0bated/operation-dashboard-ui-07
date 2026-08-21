import { describe, expect, it } from "vitest";
import { ChangeType, StateChange, StateFrameKind } from "@/grpc/gen/operation";
import { decodeStateChange } from "@/json-render/stream/decode";

/**
 * The hand-rolled reader in `decode.ts` only reads the fields the UI needs and
 * skips the rest. Encoding here with the real protobuf codec is the point: the
 * fields it skips (change_id, object_path, old_value, tags_touched, event_hash,
 * timestamp, actor_id) are all length-delimited, and a skip that mis-accounts
 * for the length prefix drifts the stream into the middle of the next field.
 */
function encode(change: Partial<StateChange>): Uint8Array {
  return StateChange.toBinary({
    changeId: "",
    eventId: 0n as unknown as bigint,
    pluginId: "",
    objectPath: "",
    changeType: ChangeType.PROPERTY_SET,
    memberName: "",
    tagsTouched: [],
    eventHash: "",
    actorId: "",
    frameKind: StateFrameKind.UPDATE,
    schemaHash: "",
    catalogHash: "",
    ...change,
  } as StateChange);
}

describe("decodeStateChange", () => {
  it("reads past skipped length-delimited fields without drifting", () => {
    const bytes = encode({
      changeId: "schema:fail2ban:c046266bfbb29e00",
      pluginId: "fail2ban",
      objectPath: "/org/opdbus/v1/plugins/fail2ban",
      changeType: ChangeType.SCHEMA_MIGRATION,
      actorId: "schema_hydration",
      tagsTouched: ["security", "service"],
      eventHash: "0".repeat(64),
      frameKind: StateFrameKind.INITIAL_STATE,
      schemaHash: "c".repeat(64),
      catalogHash: "6".repeat(64),
    });

    const change = decodeStateChange(bytes);

    expect(change).not.toBeNull();
    expect(change!.pluginId).toBe("fail2ban");
    expect(change!.changeType).toBe(ChangeType.SCHEMA_MIGRATION);
    expect(change!.frameKind).toBe(StateFrameKind.INITIAL_STATE);
    expect(change!.schemaHash).toBe("c".repeat(64));
    expect(change!.catalogHash).toBe("6".repeat(64));
  });

  it("survives a change_id whose length prefix is multi-byte", () => {
    // A length >= 128 needs a two-byte varint prefix, so an off-by-N skip
    // rewinds further and lands deeper inside the following field.
    const bytes = encode({
      changeId: "x".repeat(300),
      pluginId: "antigravity",
      objectPath: "/org/opdbus/v1/plugins/antigravity",
      actorId: "state_sync_initial_state",
      schemaHash: "a".repeat(64),
    });

    const change = decodeStateChange(bytes);

    expect(change!.pluginId).toBe("antigravity");
    expect(change!.schemaHash).toBe("a".repeat(64));
  });

  it("decodes a struct payload into plain values", () => {
    const bytes = encode({
      pluginId: "agent_config",
      newValue: {
        kind: {
          oneofKind: "structValue",
          structValue: {
            fields: {
              agents: { kind: { oneofKind: "listValue", listValue: { values: [] } } },
              enabled: { kind: { oneofKind: "boolValue", boolValue: true } },
            },
          },
        },
      },
      schemaHash: "d".repeat(64),
    } as Partial<StateChange>);

    const change = decodeStateChange(bytes);

    expect(change!.pluginId).toBe("agent_config");
    expect(change!.newValue).toEqual({ agents: [], enabled: true });
  });

  it("drops heartbeat frames", () => {
    const bytes = encode({ frameKind: StateFrameKind.HEARTBEAT, catalogHash: "9".repeat(64) });
    expect(decodeStateChange(bytes)).toBeNull();
  });
});
