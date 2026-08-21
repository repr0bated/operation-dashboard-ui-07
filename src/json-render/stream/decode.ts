/**
 * Minimal protobuf decoder for operation.v1.StateChange.
 *
 * Field numbers from op-grpc-bridge proto/operation.proto:
 *   1  string change_id
 *   2  uint64 event_id
 *   3  string plugin_id
 *   4  string object_path
 *   5  ChangeType change_type
 *   6  string member_name
 *   7  google.protobuf.Value old_value
 *   8  google.protobuf.Value new_value
 *  13  StateFrameKind frame_kind
 *  14  string schema_hash
 *  15  string catalog_hash
 */

export const STATE_FRAME_HEARTBEAT = 3;
export const CHANGE_TYPE_SCHEMA_MIGRATION = 7;

export interface DecodedStateChange {
  pluginId: string;
  memberName: string | undefined;
  newValue: unknown;
  frameKind: number;
  changeType: number;
  schemaHash: string;
  catalogHash: string;
}

export function decodeStateChange(buf: Uint8Array): DecodedStateChange | null {
  try {
    const reader = new ProtoReader(buf);
    let pluginId = "";
    let memberName: string | undefined;
    let newValue: unknown;
    let frameKind = 0;
    let changeType = 0;
    let schemaHash = "";
    let catalogHash = "";

    while (reader.hasMore()) {
      const tag = reader.readTag();
      const fieldNumber = tag >>> 3;
      const wireType = tag & 0x07;

      switch (fieldNumber) {
        case 3: pluginId = reader.readString(); break;
        case 5: changeType = reader.readVarint(); break;
        case 6: memberName = reader.readString() || undefined; break;
        case 8: newValue = decodeValue(reader.readBytes()); break;
        case 13: frameKind = reader.readVarint(); break;
        case 14: schemaHash = reader.readString(); break;
        case 15: catalogHash = reader.readString(); break;
        default: reader.skip(wireType); break;
      }
    }

    if (frameKind === STATE_FRAME_HEARTBEAT) return null;
    if (!pluginId) return null;

    return { pluginId, memberName, newValue, frameKind, changeType, schemaHash, catalogHash };
  } catch {
    return null;
  }
}

/** Decode google.protobuf.Value → JS value */
function decodeValue(buf: Uint8Array): unknown {
  if (buf.length === 0) return null;
  const reader = new ProtoReader(buf);
  while (reader.hasMore()) {
    const tag = reader.readTag();
    const fieldNumber = tag >>> 3;
    switch (fieldNumber) {
      case 1: return null; // null_value
      case 2: return reader.readDouble(); // number_value
      case 3: return reader.readString(); // string_value
      case 4: return reader.readVarint() !== 0; // bool_value
      case 5: return decodeStruct(reader.readBytes()); // struct_value
      case 6: return decodeListValue(reader.readBytes()); // list_value
      default: reader.skip(tag & 0x07); break;
    }
  }
  return null;
}

/** Decode google.protobuf.Struct → Record<string, unknown> */
function decodeStruct(buf: Uint8Array): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const reader = new ProtoReader(buf);
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if ((tag >>> 3) === 1) {
      // fields: map<string, Value> — each entry is a length-delimited sub-message
      const entryBuf = reader.readBytes();
      const entryReader = new ProtoReader(entryBuf);
      let key = "";
      let value: unknown = null;
      while (entryReader.hasMore()) {
        const entryTag = entryReader.readTag();
        if ((entryTag >>> 3) === 1) key = entryReader.readString();
        else if ((entryTag >>> 3) === 2) value = decodeValue(entryReader.readBytes());
        else entryReader.skip(entryTag & 0x07);
      }
      if (key) result[key] = value;
    } else {
      reader.skip(tag & 0x07);
    }
  }
  return result;
}

/** Decode google.protobuf.ListValue → unknown[] */
function decodeListValue(buf: Uint8Array): unknown[] {
  const result: unknown[] = [];
  const reader = new ProtoReader(buf);
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if ((tag >>> 3) === 1) {
      result.push(decodeValue(reader.readBytes()));
    } else {
      reader.skip(tag & 0x07);
    }
  }
  return result;
}

/** Minimal protobuf wire-format reader */
class ProtoReader {
  private pos = 0;
  constructor(private buf: Uint8Array) {}

  hasMore(): boolean { return this.pos < this.buf.length; }

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

  readTag(): number { return this.readVarint(); }

  readBytes(): Uint8Array {
    const len = this.readVarint();
    const bytes = this.buf.slice(this.pos, this.pos + len);
    this.pos += len;
    return bytes;
  }

  readString(): string {
    return new TextDecoder().decode(this.readBytes());
  }

  readDouble(): number {
    const bytes = this.buf.slice(this.pos, this.pos + 8);
    this.pos += 8;
    return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
  }

  skip(wireType: number): void {
    switch (wireType) {
      case 0: this.readVarint(); break;
      case 1: this.pos += 8; break;
      // The length must land in a local first: `this.pos += this.readVarint()`
      // reads this.pos before readVarint() advances it past the length prefix,
      // so the assignment discards those bytes and rewinds the stream.
      case 2: {
        const len = this.readVarint();
        this.pos += len;
        break;
      }
      case 5: this.pos += 4; break;
      default: break;
    }
  }
}
