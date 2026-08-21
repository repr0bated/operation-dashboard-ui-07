/**
 * Wire codec for op_chat.chat.ChatService (proto/chat.proto).
 * SendRequest fields: 1 conversation_id, 2 ui_messages, 4 provider, 5 model.
 * ChatFrame oneof: 2 part, 3 error, 4 heartbeat, 5 done, 6 approval.
 */

function encodeVarint(n: number): Uint8Array {
  const bytes: number[] = [];
  let x = n >>> 0;
  while (x > 0x7f) {
    bytes.push((x & 0x7f) | 0x80);
    x >>>= 7;
  }
  bytes.push(x);
  return Uint8Array.from(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeLen(field: number, payload: Uint8Array): Uint8Array {
  return concat([
    encodeVarint((field << 3) | 2),
    encodeVarint(payload.length),
    payload,
  ]);
}

function encodeString(field: number, value: string): Uint8Array {
  if (!value) return new Uint8Array(0);
  return encodeLen(field, new TextEncoder().encode(value));
}

export function encodeSendRequest(req: {
  conversationId: string;
  uiMessages: Uint8Array;
  provider: string;
  model: string;
}): Uint8Array {
  return concat([
    encodeString(1, req.conversationId),
    encodeLen(2, req.uiMessages),
    encodeString(4, req.provider),
    encodeString(5, req.model),
  ]);
}

class ProtoReader {
  private pos = 0;
  constructor(private buf: Uint8Array) {}
  hasMore(): boolean {
    return this.pos < this.buf.length;
  }
  readVarint(): number {
    let result = 0;
    let shift = 0;
    while (this.pos < this.buf.length) {
      const byte = this.buf[this.pos++]!;
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result >>> 0;
      shift += 7;
    }
    return result >>> 0;
  }
  readTag(): number {
    return this.readVarint();
  }
  readBytes(): Uint8Array {
    const len = this.readVarint();
    const bytes = this.buf.slice(this.pos, this.pos + len);
    this.pos += len;
    return bytes;
  }
  readString(): string {
    return new TextDecoder().decode(this.readBytes());
  }
  skip(wireType: number): void {
    switch (wireType) {
      case 0:
        this.readVarint();
        break;
      case 1:
        this.pos += 8;
        break;
      // The length must land in a local first: `this.pos += this.readVarint()`
      // reads this.pos before readVarint() advances it past the length prefix,
      // so the assignment discards those bytes and rewinds the stream.
      case 2: {
        const len = this.readVarint();
        this.pos += len;
        break;
      }
      case 5:
        this.pos += 4;
        break;
      default:
        break;
    }
  }
}

export type ChatFrameEvent =
  | { kind: "part"; role: string; text: string }
  | { kind: "error"; message: string }
  | { kind: "skip" };

function unwrapText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rec = parsed as { type?: unknown; text?: unknown };
      if (rec.type === "text" && typeof rec.text === "string") return rec.text;
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

export function decodeChatFrame(buf: Uint8Array): ChatFrameEvent {
  const reader = new ProtoReader(buf);
  while (reader.hasMore()) {
    const tag = reader.readTag();
    const field = tag >>> 3;
    const wire = tag & 0x07;
    if (field === 2 && wire === 2) {
      const part = new ProtoReader(reader.readBytes());
      let role = "assistant";
      let kind = "text";
      let payload = "";
      while (part.hasMore()) {
        const ptag = part.readTag();
        const pfield = ptag >>> 3;
        const pwire = ptag & 0x07;
        if (pfield === 2 && pwire === 2) role = part.readString();
        else if (pfield === 3 && pwire === 2) kind = part.readString();
        else if (pfield === 4 && pwire === 2) {
          payload = new TextDecoder().decode(part.readBytes());
        } else part.skip(pwire);
      }
      const text = kind === "text" ? unwrapText(payload) : `[${kind}] ${payload}`;
      return { kind: "part", role, text };
    }
    if (field === 3 && wire === 2) {
      const err = new ProtoReader(reader.readBytes());
      let message = "chat error";
      while (err.hasMore()) {
        const etag = err.readTag();
        const efield = etag >>> 3;
        const ewire = etag & 0x07;
        if (efield === 2 && ewire === 2) message = err.readString();
        else err.skip(ewire);
      }
      return { kind: "error", message };
    }
    reader.skip(wire);
  }
  return { kind: "skip" };
}

/** Decode `repeated string` at the given field number (ListEpisodes / QueryContext). */
export function decodeRepeatedStrings(buf: Uint8Array, field: number): string[] {
  const reader = new ProtoReader(buf);
  const out: string[] = [];
  while (reader.hasMore()) {
    const tag = reader.readTag();
    const f = tag >>> 3;
    const wire = tag & 0x07;
    if (f === field && wire === 2) out.push(reader.readString());
    else reader.skip(wire);
  }
  return out;
}
