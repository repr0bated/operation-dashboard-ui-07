import { describe, expect, it } from "vitest";
import { ChatFrame } from "@/grpc/gen/chat";
import { decodeChatFrame, decodeRepeatedStrings } from "@/json-render/stream/chat-codec";

/**
 * `decodeChatFrame` reads role/kind/payload (fields 2/3/4) and skips the rest,
 * so `UIMessagePart.message_id` and `StreamError.code` — both field 1, both
 * length-delimited — go through skip(). Encoding with the real codec is what
 * makes a mis-accounted length prefix visible: the reader lands mid-field and
 * every value after the skip is garbage.
 */
describe("decodeChatFrame", () => {
  it("reads a part whose skipped message_id precedes the fields it needs", () => {
    const bytes = ChatFrame.toBinary({
      cursor: "1",
      body: {
        oneofKind: "part",
        part: {
          messageId: "msg-7f3a1c",
          role: "assistant",
          kind: "text",
          payload: new TextEncoder().encode("hello from the bridge"),
        },
      },
    } as Parameters<typeof ChatFrame.toBinary>[0]);

    const frame = decodeChatFrame(bytes);

    expect(frame.kind).toBe("part");
    expect(frame).toMatchObject({ role: "assistant", text: "hello from the bridge" });
  });

  it("survives a message_id whose length prefix is multi-byte", () => {
    const bytes = ChatFrame.toBinary({
      cursor: "2",
      body: {
        oneofKind: "part",
        part: {
          messageId: "m".repeat(300),
          role: "tool",
          kind: "text",
          payload: new TextEncoder().encode(JSON.stringify({ type: "text", text: "unwrapped" })),
        },
      },
    } as Parameters<typeof ChatFrame.toBinary>[0]);

    const frame = decodeChatFrame(bytes);

    expect(frame).toMatchObject({ kind: "part", role: "tool", text: "unwrapped" });
  });

  it("reads an error message past the skipped code field", () => {
    const bytes = ChatFrame.toBinary({
      cursor: "3",
      body: {
        oneofKind: "error",
        error: { code: "upstream_unavailable", message: "provider refused", retryable: true },
      },
    } as Parameters<typeof ChatFrame.toBinary>[0]);

    expect(decodeChatFrame(bytes)).toEqual({ kind: "error", message: "provider refused" });
  });

  it("collects repeated strings past skipped length-delimited fields", () => {
    const bytes = ChatFrame.toBinary({
      cursor: "4",
      body: {
        oneofKind: "part",
        part: {
          messageId: "skipped",
          role: "assistant",
          kind: "text",
          payload: new Uint8Array(0),
        },
      },
    } as Parameters<typeof ChatFrame.toBinary>[0]);

    // Field 2 is the part submessage, not a string, so nothing should match and
    // the walk must still terminate having consumed the buffer exactly.
    expect(decodeRepeatedStrings(bytes, 9)).toEqual([]);
  });
});
