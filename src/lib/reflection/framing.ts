/**
 * gRPC-Web binary framing helpers.
 *
 * Wire format per frame: 1-byte flag + 4-byte big-endian length + payload.
 * Flag bit 0x80 = trailers frame; anything else = message frame.
 */

export function encodeFrame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  out[0] = 0;
  const view = new DataView(out.buffer);
  view.setUint32(1, payload.length, false);
  out.set(payload, 5);
  return out;
}

export interface DecodedFrame {
  trailers: boolean;
  data: Uint8Array;
}

export function decodeFrames(buf: Uint8Array): DecodedFrame[] {
  const frames: DecodedFrame[] = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 0;
  while (offset + 5 <= buf.length) {
    const flag = buf[offset];
    const len = view.getUint32(offset + 1, false);
    if (offset + 5 + len > buf.length) break;
    frames.push({
      trailers: (flag & 0x80) !== 0,
      data: buf.slice(offset + 5, offset + 5 + len),
    });
    offset += 5 + len;
  }
  return frames;
}

export function parseTrailers(bytes: Uint8Array): Record<string, string> {
  const text = new TextDecoder().decode(bytes);
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return out;
}
