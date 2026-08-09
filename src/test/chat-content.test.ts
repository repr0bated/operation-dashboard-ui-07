import { describe, it, expect } from "vitest";
import { unwrapContentBlocks } from "@/lib/chat-content";

describe("unwrapContentBlocks", () => {
  it("unwraps the exact envelope the chatbot rendered to the user", () => {
    const raw = '{"text":"\\n\\nHi there! How can I help you today? 😊","type":"text"}';
    expect(unwrapContentBlocks(raw)).toBe("\n\nHi there! How can I help you today? 😊");
  });

  it("joins an array of text blocks", () => {
    const raw = '[{"type":"text","text":"Hello "},{"type":"text","text":"world"}]';
    expect(unwrapContentBlocks(raw)).toBe("Hello world");
  });

  it("leaves plain text alone", () => {
    expect(unwrapContentBlocks("just a normal reply")).toBe("just a normal reply");
    expect(unwrapContentBlocks("")).toBe("");
  });

  it("leaves JSON the user actually asked for alone", () => {
    // If someone asks the assistant for JSON, that is the message — not an envelope.
    const raw = '{"name":"cron","enabled":true}';
    expect(unwrapContentBlocks(raw)).toBe(raw);
  });

  it("does not silently drop non-text blocks in a mixed payload", () => {
    const raw = '[{"type":"text","text":"hi"},{"type":"tool_use","id":"t1"}]';
    expect(unwrapContentBlocks(raw)).toBe(raw);
  });

  it("survives malformed JSON", () => {
    expect(unwrapContentBlocks('{"text":"oops"')).toBe('{"text":"oops"');
  });
});
