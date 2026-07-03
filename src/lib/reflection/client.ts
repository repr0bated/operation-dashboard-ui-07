/**
 * Client for `grpc.reflection.v1.ServerReflection` over gRPC-Web binary
 * framing. Uses `fetch()` directly so we can send a single message and
 * half-close — tonic-reflection treats that as an end-of-client-stream and
 * responds with the matching messages before closing.
 *
 * Falls back to `grpc.reflection.v1alpha.ServerReflection` on 404 / not-found
 * status, which is what older tonic-reflection releases expose.
 */
import { encodeFrame, decodeFrames, parseTrailers } from "./framing";
import { ServerReflectionRequest, ServerReflectionResponse, FileDescriptorProto } from "./protos";

const REFLECTION_PATHS = [
  "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
  "/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo",
];

function baseUrl(): string {
  if (typeof window !== "undefined") {
    const cfg = (window as unknown as { __OPDBUS_CONFIG__?: { grpcBaseUrl?: string } })
      .__OPDBUS_CONFIG__;
    if (cfg?.grpcBaseUrl) return cfg.grpcBaseUrl.replace(/\/+$/, "");
    return window.location.origin;
  }
  return "";
}

async function callReflection(payload: Uint8Array): Promise<unknown[]> {
  let lastErr: unknown = null;
  for (const path of REFLECTION_PATHS) {
    try {
      const res = await fetch(baseUrl() + path, {
        method: "POST",
        headers: {
          "content-type": "application/grpc-web+proto",
          "x-grpc-web": "1",
          "x-user-agent": "grpc-web-javascript/0.1",
        },
        body: encodeFrame(payload) as BodyInit,
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const frames = decodeFrames(buf);
      const messages: unknown[] = [];
      for (const f of frames) {
        if (f.trailers) {
          const t = parseTrailers(f.data);
          const status = t["grpc-status"];
          if (status && status !== "0") {
            throw new Error(`grpc-status ${status}: ${t["grpc-message"] ?? ""}`);
          }
          continue;
        }
        messages.push(ServerReflectionResponse.decode(f.data).toJSON());
      }
      return messages;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function listServices(): Promise<string[]> {
  const req = ServerReflectionRequest.encode(
    ServerReflectionRequest.create({ listServices: "*" }),
  ).finish();
  const msgs = await callReflection(req);
  const out: string[] = [];
  for (const m of msgs) {
    const list = (m as { listServicesResponse?: { service?: Array<{ name?: string }> } })
      .listServicesResponse;
    if (list?.service) for (const s of list.service) if (s.name) out.push(s.name);
  }
  return out;
}

export interface ReflectedMethod {
  name: string;
  inputType: string;
  outputType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
}

export interface ReflectedField {
  name: string;
  number: number;
  type: string;
  typeName: string;
  label: "optional" | "required" | "repeated";
}

export interface ReflectedMessage {
  fullName: string;
  fields: ReflectedField[];
}

export interface ReflectedService {
  fullName: string;
  packageName: string;
  fileName: string;
  methods: ReflectedMethod[];
}

export interface ReflectedFile {
  fileName: string;
  packageName: string;
  services: ReflectedService[];
  messages: ReflectedMessage[];
}

const FIELD_TYPES: Record<number, string> = {
  1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32",
  6: "fixed64", 7: "fixed32", 8: "bool", 9: "string", 10: "group",
  11: "message", 12: "bytes", 13: "uint32", 14: "enum", 15: "sfixed32",
  16: "sfixed64", 17: "sint32", 18: "sint64",
};
const LABELS: Record<number, ReflectedField["label"]> = {
  1: "optional", 2: "required", 3: "repeated",
};

interface DescMsg {
  name?: string;
  field?: Array<{
    name?: string;
    number?: number;
    type?: number;
    typeName?: string;
    label?: number;
  }>;
  nestedType?: DescMsg[];
}

function walkMessages(pkg: string, msgs: DescMsg[] | undefined, out: ReflectedMessage[]) {
  if (!msgs) return;
  for (const m of msgs) {
    const full = pkg ? `${pkg}.${m.name ?? ""}` : m.name ?? "";
    out.push({
      fullName: full,
      fields:
        m.field?.map((f) => ({
          name: f.name ?? "",
          number: f.number ?? 0,
          type: FIELD_TYPES[f.type ?? 0] ?? "unknown",
          typeName: f.typeName ?? "",
          label: LABELS[f.label ?? 1] ?? "optional",
        })) ?? [],
    });
    walkMessages(full, m.nestedType, out);
  }
}

export async function fileContainingSymbol(symbol: string): Promise<ReflectedFile[]> {
  const req = ServerReflectionRequest.encode(
    ServerReflectionRequest.create({ fileContainingSymbol: symbol }),
  ).finish();
  const msgs = await callReflection(req);
  const files: ReflectedFile[] = [];
  const seen = new Set<string>();
  for (const m of msgs) {
    const fd = (m as {
      fileDescriptorResponse?: { fileDescriptorProto?: string[] };
    }).fileDescriptorResponse;
    if (!fd?.fileDescriptorProto) continue;
    for (const b64 of fd.fileDescriptorProto) {
      // protobufjs toJSON emits bytes as base64 strings.
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decoded = FileDescriptorProto.decode(bin) as any;
      const fileName = decoded.name ?? "";
      if (seen.has(fileName)) continue;
      seen.add(fileName);
      const pkg = decoded["package"] ?? "";
      const services: ReflectedService[] = (decoded.service ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (svc: any) => ({
          fullName: pkg ? `${pkg}.${svc.name}` : svc.name,
          packageName: pkg,
          fileName,
          methods: (svc.method ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mth: any) => ({
              name: mth.name ?? "",
              inputType: mth.inputType ?? "",
              outputType: mth.outputType ?? "",
              clientStreaming: !!mth.clientStreaming,
              serverStreaming: !!mth.serverStreaming,
            }),
          ),
        }),
      );
      const messages: ReflectedMessage[] = [];
      walkMessages(pkg, decoded.messageType, messages);
      files.push({ fileName, packageName: pkg, services, messages });
    }
  }
  return files;
}
