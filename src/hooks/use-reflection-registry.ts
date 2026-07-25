/**
 * Live gRPC reflection registry.
 *
 * Talks to `grpc.reflection.v1.ServerReflection/ServerReflectionInfo` over
 * gRPC-Web. Sends one framed request per query (list_services, then
 * file_containing_symbol for each service) and reads the streamed response.
 *
 * Returns the discovered services with method + input/output type names,
 * decoded from FileDescriptorProto bytes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ServerReflectionRequest,
  ServerReflectionResponse,
} from "@/grpc/gen/grpc/reflection/v1/reflection";
import { FileDescriptorProto } from "@/grpc/gen/google/protobuf/descriptor";
import { identityHeaders } from "@/lib/identity";

export interface ReflectedMethod {
  name: string;
  /** Fully-qualified request message type (leading dot stripped). */
  inputType: string;
  /** Fully-qualified response message type (leading dot stripped). */
  outputType: string;
  /** True if either side is declared `stream`. */
  clientStreaming: boolean;
  serverStreaming: boolean;
}

export interface ReflectedService {
  /** Fully-qualified service name, e.g. "operation.v1.StateSync". */
  name: string;
  methods: ReflectedMethod[];
}

export interface ReflectionRegistry {
  services: ReflectedService[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastFetchedAt: number | null;
}

const REFLECTION_PATH =
  "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo";
const CONTENT_TYPE = "application/grpc-web+proto";

function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = (window as unknown as {
      __OPDBUS_CONFIG__?: { grpcBaseUrl?: string };
    }).__OPDBUS_CONFIG__?.grpcBaseUrl;
    if (runtime) return runtime.replace(/\/+$/, "");
  }
  const envUrl = import.meta.env.VITE_GRPC_BASE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function frame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length);
  out[0] = 0x00;
  new DataView(out.buffer).setUint32(1, payload.length, false);
  out.set(payload, 5);
  return out;
}

/**
 * Send one ServerReflectionRequest and collect the response frames.
 * We POST a single framed message and let the fetch body close as EOF —
 * tonic-reflection then emits its response(s) and terminates the stream.
 */
async function reflectionCall(
  req: ServerReflectionRequest,
  signal: AbortSignal,
): Promise<ServerReflectionResponse[]> {
  const url = `${resolveBaseUrl()}${REFLECTION_PATH}`;
  const body = frame(ServerReflectionRequest.toBinary(req));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": CONTENT_TYPE,
      Accept: CONTENT_TYPE,
      "x-grpc-web": "1",
      ...identityHeaders(),
    },
    body: body as BodyInit,
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`reflection HTTP ${res.status}`);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  const messages: ServerReflectionResponse[] = [];
  const trailers = new Map<string, string>();
  let offset = 0;
  while (offset + 5 <= buf.length) {
    const flags = buf[offset];
    const len = new DataView(buf.buffer, buf.byteOffset + offset + 1, 4).getUint32(0, false);
    offset += 5;
    if (offset + len > buf.length) break;
    const payload = buf.slice(offset, offset + len);
    offset += len;
    if (flags & 0x80) {
      const text = new TextDecoder().decode(payload);
      for (const line of text.split(/\r?\n/)) {
        const idx = line.indexOf(":");
        if (idx > 0) trailers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
      }
    } else {
      try {
        messages.push(ServerReflectionResponse.fromBinary(payload));
      } catch {
        /* skip undecodable */
      }
    }
  }
  const st = trailers.get("grpc-status") ?? res.headers.get("grpc-status") ?? "0";
  if (st !== "0") {
    const msg = trailers.get("grpc-message") ?? res.headers.get("grpc-message") ?? "reflection error";
    throw new Error(`grpc ${st}: ${msg}`);
  }
  return messages;
}

function stripDot(s: string | undefined): string {
  return (s ?? "").replace(/^\./, "");
}

async function discover(signal: AbortSignal): Promise<ReflectedService[]> {
  // 1. Enumerate all services.
  const listResp = await reflectionCall(
    { host: "", messageRequest: { oneofKind: "listServices", listServices: "*" } },
    signal,
  );
  const serviceNames = new Set<string>();
  for (const m of listResp) {
    const mr = m.messageResponse;
    if (mr.oneofKind === "listServicesResponse") {
      for (const s of mr.listServicesResponse.service) {
        if (s.name && s.name !== "grpc.reflection.v1.ServerReflection") {
          serviceNames.add(s.name);
        }
      }
    } else if (mr.oneofKind === "errorResponse") {
      throw new Error(mr.errorResponse.errorMessage);
    }
  }

  // 2. Fetch each service's file descriptor to enumerate methods + types.
  const services: ReflectedService[] = [];
  const seenFiles = new Set<string>();

  await Promise.all(
    Array.from(serviceNames).map(async (svcName) => {
      try {
        const resp = await reflectionCall(
          {
            host: "",
            messageRequest: {
              oneofKind: "fileContainingSymbol",
              fileContainingSymbol: svcName,
            },
          },
          signal,
        );

        for (const m of resp) {
          if (m.messageResponse.oneofKind !== "fileDescriptorResponse") continue;
          for (const bytes of m.messageResponse.fileDescriptorResponse.fileDescriptorProto) {
            let fd;
            try {
              fd = FileDescriptorProto.fromBinary(bytes);
            } catch {
              continue;
            }
            const fileKey = fd.name ?? Math.random().toString(36);
            if (seenFiles.has(fileKey)) continue;
            seenFiles.add(fileKey);

            const pkg = fd.package ?? "";
            for (const svc of fd.service ?? []) {
              const fqn = pkg ? `${pkg}.${svc.name}` : (svc.name ?? "");
              if (!fqn) continue;
              services.push({
                name: fqn,
                methods: (svc.method ?? []).map((mm) => ({
                  name: mm.name ?? "",
                  inputType: stripDot(mm.inputType),
                  outputType: stripDot(mm.outputType),
                  clientStreaming: !!mm.clientStreaming,
                  serverStreaming: !!mm.serverStreaming,
                })),
              });
            }
          }
        }
      } catch (err) {
        // Skip individual failures — surface the service as method-less.
        if (!services.find((s) => s.name === svcName)) {
          services.push({ name: svcName, methods: [] });
        }
        console.warn("[reflection] failed to describe", svcName, err);
      }
    }),
  );

  services.sort((a, b) => a.name.localeCompare(b.name));
  return services;
}

/**
 * Poll reflection every `intervalMs` (default 30s). Set `intervalMs=0` to
 * disable auto-refresh.
 */
export function useReflectionRegistry(intervalMs = 30_000): ReflectionRegistry {
  const [services, setServices] = useState<ReflectedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const nonce = useRef(0);

  const run = useCallback(() => {
    const controller = new AbortController();
    const id = ++nonce.current;
    setLoading(true);
    discover(controller.signal)
      .then((svcs) => {
        if (id !== nonce.current) return;
        setServices(svcs);
        setError(null);
        setLastFetchedAt(Date.now());
      })
      .catch((e: Error) => {
        if (id !== nonce.current) return;
        setError(e.message);
      })
      .finally(() => {
        if (id === nonce.current) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cancel = run();
    if (intervalMs <= 0) return cancel;
    const timer = setInterval(run, intervalMs);
    return () => {
      cancel?.();
      clearInterval(timer);
    };
  }, [run, intervalMs]);

  return {
    services,
    loading,
    error,
    refresh: run,
    lastFetchedAt,
  };
}
