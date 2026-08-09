/**
 * google.protobuf.Value / Struct helpers.
 *
 * Depending on transport, a Value arrives either already JSON-shaped
 * (grpc-web+json) or as a decoded protobuf-ts message with a `kind` oneof
 * (`{ kind: { oneofKind: 'stringValue', stringValue: '…' } }`). These helpers
 * normalise both shapes into plain JS.
 */
export type ProtobufStruct = Record<string, unknown>;
export type ProtobufValue = unknown;

interface OneofKind {
  oneofKind?: string;
  [k: string]: unknown;
}

function isValueMessage(v: unknown): v is { kind: OneofKind } {
  return (
    typeof v === "object" &&
    v !== null &&
    "kind" in v &&
    typeof (v as { kind: unknown }).kind === "object" &&
    (v as { kind: OneofKind }).kind !== null &&
    "oneofKind" in ((v as { kind: OneofKind }).kind as object)
  );
}

/** Convert a protobuf Value to a plain JS value (idempotent for plain JSON). */
export function valueToJs(v: ProtobufValue): unknown {
  if (Array.isArray(v)) return v.map(valueToJs);

  if (isValueMessage(v)) {
    const kind = v.kind;
    switch (kind.oneofKind) {
      case "nullValue":
        return null;
      case "numberValue":
        return kind.numberValue as number;
      case "stringValue":
        return kind.stringValue as string;
      case "boolValue":
        return kind.boolValue as boolean;
      case "structValue": {
        const sv = kind.structValue as { fields?: Record<string, unknown> } | undefined;
        return structToObject(sv);
      }
      case "listValue": {
        const lv = kind.listValue as { values?: unknown[] } | undefined;
        return (lv?.values ?? []).map(valueToJs);
      }
      default:
        return undefined;
    }
  }

  if (typeof v === "object" && v !== null) {
    // Bare Struct message, or plain object of values.
    return structToObject(v as ProtobufStruct);
  }

  return v;
}

/** Convert a protobuf Struct (either `{ fields }` or plain JSON) to a plain object. */
export function structToObject(s: unknown): Record<string, unknown> {
  if (!s || typeof s !== "object") return {};
  const src =
    "fields" in (s as object) && typeof (s as { fields: unknown }).fields === "object"
      ? ((s as { fields: Record<string, unknown> }).fields ?? {})
      : (s as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(src)) out[k] = valueToJs(val);
  return out;
}

/** Convert a JS object to a protobuf Struct */
export function objectToStruct(obj: Record<string, unknown>): ProtobufStruct {
  return obj;
}
