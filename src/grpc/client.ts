/**
 * gRPC-Web Transport & Service Clients
 *
 * This module provides the gRPC-Web transport layer and typed service
 * client wrappers for all services in the operation-dbus architecture:
 *
 * Bridge services (op-grpc-bridge):
 *   - StateSync, PluginService, EventChainService
 *   - OvsdbMirror, RuntimeMirror, ComponentRegistry
 *
 * Domain services:
 *   - MailService (operation.mail.v1)
 *   - RegistrationService (operation.registration.v1)
 *   - PrivacyNetworkService (operation.privacy.v1)
 *   - ServiceManager (opdbus.services.v1)
 *   - McpService (op.mcp.v1)
 *
 * Uses binary gRPC-Web framing over tonic-web + Nginx.
 * @see docs/architecture-flow.md
 */

import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import type { IMessageType } from "@protobuf-ts/runtime";
import type { ServiceType } from "@protobuf-ts/runtime-rpc";
import { identityHeaders } from "@/lib/identity";
import {
  StateSync as StateSyncSvc,
  PluginService as PluginServiceSvc,
  EventChainService as EventChainServiceSvc,
  OvsdbMirror as OvsdbMirrorSvc,
  RuntimeMirror as RuntimeMirrorSvc,
  DbusPassthrough as DbusPassthroughSvc,
} from "./gen/operation";
import { ComponentRegistry as ComponentRegistrySvc } from "./gen/registry";
import { MailService as MailServiceSvc } from "./gen/mail";
import { PrivacyNetworkService as PrivacyNetworkServiceSvc } from "./gen/privacy_network";
import { RegistrationService as RegistrationServiceSvc } from "./gen/registration";
import { McpService as McpServiceSvc } from "./gen/mcp";
import { ServiceManager as ServiceManagerSvc } from "./gen/services";

/**
 * Map any backend failure to a generic, user-safe message.
 * Full details (status, service/method, server body) are logged to the
 * browser console only — never bubbled into UI strings or event-store state.
 */
function safeGrpcError(
  service: string,
  method: string,
  detail: { status?: number; grpcStatus?: string; grpcMessage?: string; body?: string; cause?: unknown },
): Error {
  // eslint-disable-next-line no-console
  console.error("[grpc] call failed", { service, method, ...detail });
  if (detail.status === 401 || detail.grpcStatus === "16") {
    return new Error("Authentication required.");
  }
  if (detail.status === 403 || detail.grpcStatus === "7") {
    return new Error("You do not have access to this resource.");
  }
  if (detail.status === 404 || detail.grpcStatus === "5" || detail.grpcStatus === "12") {
    return new Error("Service unavailable — try again.");
  }
  if (detail.status === 429 || detail.grpcStatus === "8") {
    return new Error("Too many requests — please slow down.");
  }
  return new Error("Service unavailable — try again.");
}

/**
 * Auth model: identity = caller's WireGuard public key, enforced at the
 * WG mesh boundary and re-validated by op-web against the identity sled.
 * No bearer tokens are attached client-side.
 *
 * Wire format is **binary** gRPC-Web (`application/grpc-web+proto`). tonic-web
 * does not accept `application/grpc-web+json` (returns HTTP 400).
 */

// ── Transport Configuration ─────────────────────────────────────────────────
//
// Resolution order (first match wins):
//   1. Runtime override:  window.__OPDBUS_CONFIG__.grpcBaseUrl  (injected by op-web)
//   2. Build-time env:    VITE_GRPC_BASE_URL
//   3. Same-origin:       window.location.origin   (when served from the gateway itself)

declare global {
  interface Window {
    __OPDBUS_CONFIG__?: {
      grpcBaseUrl?: string;
      apiBaseUrl?: string;
      ghostbridgeFootprint?: string;
      ghostbridgeTraceId?: string;
    };
  }
}

function resolveGrpcBaseUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__OPDBUS_CONFIG__?.grpcBaseUrl;
    if (runtime) return runtime.replace(/\/+$/, "");
  }
  const envUrl = import.meta.env.VITE_GRPC_BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

// Override that takes precedence over runtime/env once set via resetTransport().
let _baseUrlOverride: string | null = null;

/** Resolved lazily on every call so runtime config injected post-load is honored. */
function getBaseUrl(): string {
  return _baseUrlOverride ?? resolveGrpcBaseUrl();
}

let _transport: GrpcWebFetchTransport | null = null;

export function getTransport(): GrpcWebFetchTransport {
  if (!_transport) {
    _transport = new GrpcWebFetchTransport({
      baseUrl: getBaseUrl(),
      format: "binary",
      meta: identityMeta(),
    });
  }
  return _transport;
}

/** Update the base URL used by all subsequent unary + stream calls. */
export function resetTransport(baseUrl?: string): void {
  if (baseUrl !== undefined) _baseUrlOverride = baseUrl.replace(/\/+$/, "");
  _transport = new GrpcWebFetchTransport({
    baseUrl: getBaseUrl(),
    format: "binary",
    meta: identityMeta(),
  });
}

// ── Ghostbridge identity headers ────────────────────────────────────────────
// Server GhostbridgeInterceptor requires x-ghostbridge-footprint +
// x-ghostbridge-trace-id matching /dev/shm/plugin_schema.dat. Xray injects
// these on the public path. Locally: pair session, GET /api/identity/sled,
// VITE_GHOSTBRIDGE_*, or window.__OPDBUS_CONFIG__. See src/lib/identity.ts.

function identityMeta(): Record<string, string> {
  return { "x-grpc-web": "1", ...identityHeaders() };
}

// ── Binary codec registry (service/method → protobuf-ts MessageType) ────────

type CodecPair = { I: IMessageType<object>; O: IMessageType<object> };

const CODEC_REGISTRY: Map<string, CodecPair> = (() => {
  const map = new Map<string, CodecPair>();
  const services: ServiceType[] = [
    StateSyncSvc,
    PluginServiceSvc,
    EventChainServiceSvc,
    OvsdbMirrorSvc,
    RuntimeMirrorSvc,
    DbusPassthroughSvc,
    ComponentRegistrySvc,
    MailServiceSvc,
    PrivacyNetworkServiceSvc,
    RegistrationServiceSvc,
    McpServiceSvc,
    ServiceManagerSvc as unknown as ServiceType,
  ];
  for (const svc of services) {
    for (const m of svc.methods) {
      map.set(`${svc.typeName}/${m.name}`, {
        I: m.I as IMessageType<object>,
        O: m.O as IMessageType<object>,
      });
    }
  }
  return map;
})();


function lookupCodec(service: string, method: string): CodecPair | null {
  return CODEC_REGISTRY.get(`${service}/${method}`) ?? null;
}

function encodeRequest(service: string, method: string, request: unknown): Uint8Array {
  const codec = lookupCodec(service, method);
  if (!codec) {
    // No codec (stub / view-type only): send empty protobuf message.
    return new Uint8Array(0);
  }
  const msg = codec.I.create(request as object);
  return codec.I.toBinary(msg);
}

function decodeResponse<TResp>(service: string, method: string, bytes: Uint8Array): TResp {
  const codec = lookupCodec(service, method);
  if (!codec) {
    return {} as TResp;
  }
  if (bytes.length === 0) {
    return codec.O.create() as TResp;
  }
  return codec.O.fromBinary(bytes) as TResp;
}

// ── Generic gRPC-Web call helpers (binary protobuf framing) ─────────────────

const GRPC_CONTENT_TYPE = "application/grpc-web+proto";

function frameMessage(payloadBytes: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + payloadBytes.length);
  frame[0] = 0x00; // data frame, uncompressed
  new DataView(frame.buffer).setUint32(1, payloadBytes.length, false);
  frame.set(payloadBytes, 5);
  return frame;
}

async function grpcUnary<TReq, TResp>(
  service: string,
  method: string,
  request: TReq,
): Promise<TResp> {
  const url = `${getBaseUrl()}/${service}/${method}`;
  const frame = frameMessage(encodeRequest(service, method, request));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": GRPC_CONTENT_TYPE,
      Accept: GRPC_CONTENT_TYPE,
      ...identityMeta(),
    },
    body: frame as BodyInit,

  });

  if (!res.ok) {
    let text = "";
    try { text = await res.text(); } catch { /* ignore */ }
    throw safeGrpcError(service, method, { status: res.status, body: text });
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  const { dataFrames, trailers } = parseGrpcWebResponse(buf);

  const grpcStatus = trailers.get("grpc-status") ?? res.headers.get("grpc-status");
  const grpcMessage = trailers.get("grpc-message") ?? res.headers.get("grpc-message");
  if (grpcStatus && grpcStatus !== "0") {
    throw safeGrpcError(service, method, {
      grpcStatus: grpcStatus ?? undefined,
      grpcMessage: grpcMessage ? decodeURIComponent(grpcMessage) : undefined,
    });
  }

  if (dataFrames.length === 0) {
    return decodeResponse<TResp>(service, method, new Uint8Array(0));
  }
  return decodeResponse<TResp>(service, method, dataFrames[0]);
}

/** Parse gRPC-Web response: data frames (flag 0x00) and trailer key/values (flag 0x80). */
function parseGrpcWebResponse(buf: Uint8Array): {
  dataFrames: Uint8Array[];
  trailers: Map<string, string>;
} {
  const dataFrames: Uint8Array[] = [];
  const trailers = new Map<string, string>();
  let offset = 0;
  while (offset + 5 <= buf.length) {
    const flags = buf[offset];
    const dv = new DataView(buf.buffer, buf.byteOffset + offset + 1, 4);
    const len = dv.getUint32(0, false);
    offset += 5;
    if (offset + len > buf.length) break;
    const payload = buf.slice(offset, offset + len);
    if (flags & 0x80) {
      const text = new TextDecoder().decode(payload);
      for (const line of text.split(/\r?\n/)) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          trailers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
        }
      }
    } else {
      dataFrames.push(payload);
    }
    offset += len;
  }
  return { dataFrames, trailers };
}

function grpcServerStream<TReq, TResp>(
  service: string,
  method: string,
  request: TReq,
): { stream: ReadableStream<TResp>; abort: () => void } {
  const controller = new AbortController();
  const url = `${getBaseUrl()}/${service}/${method}`;
  const frame = frameMessage(encodeRequest(service, method, request));

  const responsePromise = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": GRPC_CONTENT_TYPE,
      Accept: GRPC_CONTENT_TYPE,
      ...identityMeta(),
    },
    body: frame as BodyInit,
    signal: controller.signal,
  });

  const stream = new ReadableStream<TResp>({
    async start(ctrl) {
      try {
        const res = await responsePromise;
        if (!res.ok || !res.body) {
          ctrl.error(safeGrpcError(service, method, { status: res.status }));
          return;
        }

        // Some errors arrive as trailers-only with HTTP 200.
        const earlyStatus = res.headers.get("grpc-status");
        if (earlyStatus && earlyStatus !== "0") {
          ctrl.error(safeGrpcError(service, method, {
            grpcStatus: earlyStatus,
            grpcMessage: res.headers.get("grpc-message") ?? undefined,
          }));
          return;
        }

        const reader = res.body.getReader();
        let pending = new Uint8Array(0);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const merged = new Uint8Array(pending.length + value.length);
          merged.set(pending);
          merged.set(value, pending.length);
          pending = merged;

          while (pending.length >= 5) {
            const flags = pending[0];
            const dv = new DataView(pending.buffer, pending.byteOffset + 1, 4);
            const len = dv.getUint32(0, false);
            if (pending.length < 5 + len) break;

            const payload = pending.slice(5, 5 + len);
            if (flags & 0x80) {
              const text = new TextDecoder().decode(payload);
              const trailers = new Map<string, string>();
              for (const line of text.split(/\r?\n/)) {
                const idx = line.indexOf(":");
                if (idx > 0) {
                  trailers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
                }
              }
              const st = trailers.get("grpc-status");
              if (st && st !== "0") {
                ctrl.error(safeGrpcError(service, method, {
                  grpcStatus: st,
                  grpcMessage: trailers.get("grpc-message"),
                }));
                return;
              }
            } else {
              try {
                ctrl.enqueue(decodeResponse<TResp>(service, method, payload));
              } catch {
                // skip undecodable frame
              }
            }
            pending = pending.slice(5 + len);
          }
        }

        ctrl.close();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          ctrl.error(err);
        }
      }
    },
  });

  return { stream, abort: () => controller.abort() };
}

// ── Type Imports ────────────────────────────────────────────────────────────

import type {
  SubscribeRequest as StateSyncSubscribeRequest,
  StateChange,
  MutateRequest,
  MutateResponse,
  GetStateRequest,
  GetStateResponse,
  BatchMutateRequest,
  BatchMutateResponse,
  ListPluginsResponse,
  GetSchemaRequest,
  GetSchemaResponse,
  CallMethodRequest,
  CallMethodResponse,
  GetPropertyRequest,
  GetPropertyResponse,
  SetPropertyRequest,
  SetPropertyResponse,
  SubscribeSignalsRequest,
  Signal,
  GetEventsRequest,
  GetEventsResponse,
  ChainEvent,
  SubscribeEventsRequest,
  VerifyChainRequest,
  VerifyChainResponse,
  GetProofRequest,
  GetProofResponse,
  ProveTagImmutabilityRequest,
  ProveTagImmutabilityResponse,
  GetSnapshotRequest,
  GetSnapshotResponse,
  CreateSnapshotRequest,
  CreateSnapshotResponse,
  OvsdbListDbsResponse,
  OvsdbGetSchemaResponse,
  OvsdbTransactRequest,
  OvsdbTransactResponse,
  OvsdbMonitorRequest,
  OvsdbUpdate,
  OvsdbEchoRequest,
  OvsdbEchoResponse,
  OvsdbDumpDbRequest,
  OvsdbDumpDbResponse,
  OvsdbGetBridgeStateResponse,
  RuntimeGetSystemInfoResponse,
  RuntimeServiceInfo,
  RuntimeListServicesResponse,
  RuntimeStreamMetricsRequest,
  RuntimeMetricUpdate,
  RuntimeListInterfacesResponse,
  RuntimeGetNumaTopologyResponse,
} from "./gen/operation";

import type {
  DiscoverRequest,
  DiscoverResponse,
  WatchRequest,
  RegistryEvent,
  ComponentInfo,
} from "./gen/registry";

import type {
  SendEmailRequest,
  SendEmailResponse,
  GetInboxRequest,
  GetInboxResponse,
  GetMessageRequest,
  GetMessageResponse,
  GetMailStatusRequest,
  GetMailStatusResponse,
  ListMailAccountsRequest,
  ListMailAccountsResponse,
  AdminMailActionRequest,
  AdminMailActionResponse,
  CheckMailServerRequest,
  CheckMailServerResponse,
} from "./gen/mail";

import type {
  EnsurePrivacyNetworkRequest,
  EnsurePrivacyNetworkResponse,
  GetNetworkStatusRequest,
  GetNetworkStatusResponse,
  ProvisionUserRequest,
  ProvisionUserResponse,
  GetPrivacyWireGuardConfigRequest,
  GetPrivacyWireGuardConfigResponse,
  ManageComponentRequest,
  ManageComponentResponse,
  GetNetworkTopologyRequest,
  GetNetworkTopologyResponse,
  HealthCheckRequest,
  HealthCheckResponse,
  ConfigurePacketRoutingRequest,
  ConfigurePacketRoutingResponse,
  GenerateWireGuardKeyPairRequest,
  GenerateWireGuardKeyPairResponse,
} from "./gen/privacy_network";

import type {
  SendMagicLinkRequest,
  SendMagicLinkResponse,
  VerifyMagicLinkRequest,
  VerifyMagicLinkResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  GetUserStatusRequest,
  GetUserStatusResponse,
  ListUsersRequest,
  ListUsersResponse,
  GetWireGuardConfigRequest,
  GetWireGuardConfigResponse,
  AdminUserActionRequest,
  AdminUserActionResponse,
} from "./gen/registration";

import type {
  ServiceDef,
  ServiceStatus,
  ServiceEvent,
  GetServiceResponse,
  ListServicesResponse as SvcMgrListResponse,
  WatchServicesRequest,
} from "./view-types";

import type {
  InitializeRequest,
  InitializeResponse,
  ListToolsRequest,
  ListToolsResponse as McpListToolsResponse,
  CallToolRequest,
  CallToolResponse,
  ToolOutput,
  McpEvent,
  SubscribeRequest as McpSubscribeRequest,
  HealthResponse as McpHealthResponse,
  SearchEpisodesRequest,
  SearchEpisodesResponse,
  GetEpisodeRequest,
  GetEpisodeResponse,
  CollectionStatsResponse,
  ChatWithContextRequest,
  ChatWithContextResponse,
  SubscribeEpisodesRequest,
  EpisodeEvent,
  GetPiiPolicyResponse,
  GetFootprintsRequest,
  GetFootprintsResponse,
  VerifyBlockchainRequest,
  VerifyBlockchainResponse,
  GetEmbeddingQueueStatusResponse,
  GetQdrantRolesResponse,
  GetSubvolumesResponse,
  GetSnapshotsRequest as BtrfsGetSnapshotsRequest,
  GetSnapshotsResponse as BtrfsGetSnapshotsResponse,
  GetSendStateResponse,
  GetDrStatusResponse,
  CreatePersonaRequest,
  CreatePersonaResponse,
  UpdatePersonaRequest,
  UpdatePersonaResponse,
  DeletePersonaRequest,
  DeletePersonaResponse,
  ListAgentRoutesResponse,
  GetDataStoresResponse,
  GetStoreDetailRequest,
  GetStoreDetailResponse,
  GetEmbeddingQueueRequest,
  GetEmbeddingQueueResponse,
  GetEmbeddingWorkerStatusResponse,
  PreviewEmbeddingTextRequest,
  PreviewEmbeddingTextResponse,
  GetChannelDiagnosticsResponse,
} from "./view-types";

import type {
  ListPersonasResponse,
  GetPersonaRequest,
  GetPersonaResponse,
} from "./gen/persona";

// ═══════════════════════════════════════════════════════════════════════════
// BRIDGE SERVICES (op-grpc-bridge)
// ═══════════════════════════════════════════════════════════════════════════

// ── StateSync Service ───────────────────────────────────────────────────────

export const stateSync = {
  subscribe(req: Partial<StateSyncSubscribeRequest> = {}) {
    const full: StateSyncSubscribeRequest = {
      pluginIds: req.pluginIds ?? [],
      pathPatterns: req.pathPatterns ?? [],
      tags: req.tags ?? [],
      includeInitialState: req.includeInitialState ?? true,
    };
    return grpcServerStream<StateSyncSubscribeRequest, StateChange>(
      "operation.v1.StateSync",
      "Subscribe",
      full,
    );
  },

  mutate(req: MutateRequest) {
    return grpcUnary<MutateRequest, MutateResponse>(
      "operation.v1.StateSync",
      "Mutate",
      req,
    );
  },

  getState(req: GetStateRequest) {
    return grpcUnary<GetStateRequest, GetStateResponse>(
      "operation.v1.StateSync",
      "GetState",
      req,
    );
  },

  batchMutate(req: BatchMutateRequest) {
    return grpcUnary<BatchMutateRequest, BatchMutateResponse>(
      "operation.v1.StateSync",
      "BatchMutate",
      req,
    );
  },
};

// ── PluginService ───────────────────────────────────────────────────────────

export const pluginService = {
  listPlugins() {
    return grpcUnary<Record<string, never>, ListPluginsResponse>(
      "operation.v1.PluginService",
      "ListPlugins",
      {},
    );
  },

  getSchema(req: GetSchemaRequest) {
    return grpcUnary<GetSchemaRequest, GetSchemaResponse>(
      "operation.v1.PluginService",
      "GetSchema",
      req,
    );
  },

  callMethod(req: CallMethodRequest) {
    return grpcUnary<CallMethodRequest, CallMethodResponse>(
      "operation.v1.PluginService",
      "CallMethod",
      req,
    );
  },

  getProperty(req: GetPropertyRequest) {
    return grpcUnary<GetPropertyRequest, GetPropertyResponse>(
      "operation.v1.PluginService",
      "GetProperty",
      req,
    );
  },

  setProperty(req: SetPropertyRequest) {
    return grpcUnary<SetPropertyRequest, SetPropertyResponse>(
      "operation.v1.PluginService",
      "SetProperty",
      req,
    );
  },

  subscribeSignals(req: SubscribeSignalsRequest) {
    return grpcServerStream<SubscribeSignalsRequest, Signal>(
      "operation.v1.PluginService",
      "SubscribeSignals",
      req,
    );
  },
};

// ── EventChainService ───────────────────────────────────────────────────────

export const eventChainService = {
  getEvents(req: Partial<GetEventsRequest> = {}) {
    return grpcUnary<GetEventsRequest, GetEventsResponse>(
      "operation.v1.EventChainService",
      "GetEvents",
      {
        fromEventId: String(req.fromEventId ?? "0"),
        toEventId: String(req.toEventId ?? "0"),
        limit: req.limit ?? 100,
        pluginId: req.pluginId ?? "",
        tags: req.tags ?? [],
        decisionFilter: req.decisionFilter ?? 0,
      },
    );
  },

  subscribeEvents(req: Partial<SubscribeEventsRequest> = {}) {
    return grpcServerStream<SubscribeEventsRequest, ChainEvent>(
      "operation.v1.EventChainService",
      "SubscribeEvents",
      {
        fromEventId: String(req.fromEventId ?? "0"),
        pluginId: req.pluginId ?? "",
        tags: req.tags ?? [],
      },
    );
  },

  verifyChain(req: VerifyChainRequest) {
    return grpcUnary<VerifyChainRequest, VerifyChainResponse>(
      "operation.v1.EventChainService",
      "VerifyChain",
      req,
    );
  },

  getProof(req: GetProofRequest) {
    return grpcUnary<GetProofRequest, GetProofResponse>(
      "operation.v1.EventChainService",
      "GetProof",
      req,
    );
  },

  proveTagImmutability(req: ProveTagImmutabilityRequest) {
    return grpcUnary<ProveTagImmutabilityRequest, ProveTagImmutabilityResponse>(
      "operation.v1.EventChainService",
      "ProveTagImmutability",
      req,
    );
  },

  getSnapshot(req: GetSnapshotRequest) {
    return grpcUnary<GetSnapshotRequest, GetSnapshotResponse>(
      "operation.v1.EventChainService",
      "GetSnapshot",
      req,
    );
  },

  createSnapshot(req: CreateSnapshotRequest) {
    return grpcUnary<CreateSnapshotRequest, CreateSnapshotResponse>(
      "operation.v1.EventChainService",
      "CreateSnapshot",
      req,
    );
  },
};

// ── OvsdbMirror Service ─────────────────────────────────────────────────────

export const ovsdbMirror = {
  listDbs() {
    return grpcUnary<Record<string, never>, OvsdbListDbsResponse>(
      "operation.v1.OvsdbMirror",
      "ListDbs",
      {},
    );
  },

  getSchema(db: string) {
    return grpcUnary<{ database: string }, OvsdbGetSchemaResponse>(
      "operation.v1.OvsdbMirror",
      "GetSchema",
      { database: db },
    );
  },

  transact(req: OvsdbTransactRequest) {
    return grpcUnary<OvsdbTransactRequest, OvsdbTransactResponse>(
      "operation.v1.OvsdbMirror",
      "Transact",
      req,
    );
  },

  monitor(req: OvsdbMonitorRequest) {
    return grpcServerStream<OvsdbMonitorRequest, OvsdbUpdate>(
      "operation.v1.OvsdbMirror",
      "Monitor",
      req,
    );
  },

  echo(req: OvsdbEchoRequest) {
    return grpcUnary<OvsdbEchoRequest, OvsdbEchoResponse>(
      "operation.v1.OvsdbMirror",
      "Echo",
      req,
    );
  },

  dumpDb(db: string) {
    return grpcUnary<OvsdbDumpDbRequest, OvsdbDumpDbResponse>(
      "operation.v1.OvsdbMirror",
      "DumpDb",
      { database: db },
    );
  },

  getBridgeState(bridgeName = "") {
    return grpcUnary<{ bridgeName: string }, OvsdbGetBridgeStateResponse>(
      "operation.v1.OvsdbMirror",
      "GetBridgeState",
      { bridgeName },
    );
  },
};

// ── RuntimeMirror Service ───────────────────────────────────────────────────

export const runtimeMirror = {
  getSystemInfo() {
    return grpcUnary<Record<string, never>, RuntimeGetSystemInfoResponse>(
      "operation.v1.RuntimeMirror",
      "GetSystemInfo",
      {},
    );
  },

  listServices(stateFilter = "") {
    return grpcUnary<{ stateFilter: string }, RuntimeListServicesResponse>(
      "operation.v1.RuntimeMirror",
      "ListServices",
      { stateFilter },
    );
  },

  getService(serviceName: string) {
    return grpcUnary<{ serviceName: string }, RuntimeServiceInfo>(
      "operation.v1.RuntimeMirror",
      "GetService",
      { serviceName },
    );
  },

  streamMetrics(req: Partial<RuntimeStreamMetricsRequest> = {}) {
    return grpcServerStream<RuntimeStreamMetricsRequest, RuntimeMetricUpdate>(
      "operation.v1.RuntimeMirror",
      "StreamMetrics",
      {
        intervalSeconds: req.intervalSeconds ?? 5,
        categories: req.categories ?? [],
      },
    );
  },

  listInterfaces() {
    return grpcUnary<Record<string, never>, RuntimeListInterfacesResponse>(
      "operation.v1.RuntimeMirror",
      "ListInterfaces",
      {},
    );
  },

  getNumaTopology() {
    return grpcUnary<Record<string, never>, RuntimeGetNumaTopologyResponse>(
      "operation.v1.RuntimeMirror",
      "GetNumaTopology",
      {},
    );
  },
};

// ── ComponentRegistry Service ───────────────────────────────────────────────

export const componentRegistry = {
  discover(req: Partial<DiscoverRequest> = {}) {
    return grpcUnary<DiscoverRequest, DiscoverResponse>(
      "operation.registry.v1.ComponentRegistry",
      "Discover",
      {
        componentType: req.componentType ?? "",
        capability: req.capability ?? "",
        metadataKey: req.metadataKey ?? "",
        metadataValue: req.metadataValue ?? "",
        includeStale: req.includeStale ?? false,
      },
    );
  },

  watch(req: Partial<WatchRequest> = {}) {
    return grpcServerStream<WatchRequest, RegistryEvent>(
      "operation.registry.v1.ComponentRegistry",
      "Watch",
      {
        componentTypes: req.componentTypes ?? [],
        includeExisting: req.includeExisting ?? true,
      },
    );
  },

  getComponent(componentId: string) {
    return grpcUnary<
      { componentId: string },
      { component: ComponentInfo; found: boolean }
    >("operation.registry.v1.ComponentRegistry", "GetComponent", {
      componentId,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN SERVICES
// ═══════════════════════════════════════════════════════════════════════════

// ── MailService (operation.mail.v1) ─────────────────────────────────────────

export const mailService = {
  sendEmail(req: SendEmailRequest) {
    return grpcUnary<SendEmailRequest, SendEmailResponse>(
      "operation.mail.v1.MailService",
      "SendEmail",
      req,
    );
  },

  getInbox(req: GetInboxRequest) {
    return grpcUnary<GetInboxRequest, GetInboxResponse>(
      "operation.mail.v1.MailService",
      "GetInbox",
      req,
    );
  },

  getMessage(req: GetMessageRequest) {
    return grpcUnary<GetMessageRequest, GetMessageResponse>(
      "operation.mail.v1.MailService",
      "GetMessage",
      req,
    );
  },

  getMailStatus(req: Partial<GetMailStatusRequest> = {}) {
    return grpcUnary<GetMailStatusRequest, GetMailStatusResponse>(
      "operation.mail.v1.MailService",
      "GetMailStatus",
      { domain: req.domain ?? "" },
    );
  },

  listMailAccounts(req: Partial<ListMailAccountsRequest> = {}) {
    return grpcUnary<ListMailAccountsRequest, ListMailAccountsResponse>(
      "operation.mail.v1.MailService",
      "ListMailAccounts",
      {
        domain: req.domain ?? "",
        includeInactive: req.includeInactive ?? false,
      },
    );
  },

  adminMailAction(req: AdminMailActionRequest) {
    return grpcUnary<AdminMailActionRequest, AdminMailActionResponse>(
      "operation.mail.v1.MailService",
      "AdminMailAction",
      req,
    );
  },

  checkMailServer(req: Partial<CheckMailServerRequest> = {}) {
    return grpcUnary<CheckMailServerRequest, CheckMailServerResponse>(
      "operation.mail.v1.MailService",
      "CheckMailServer",
      {
        domain: req.domain ?? "",
        checkSmtp: req.checkSmtp ?? true,
        checkImap: req.checkImap ?? true,
        checkWebmail: req.checkWebmail ?? true,
      },
    );
  },
};

// ── PrivacyNetworkService (operation.privacy.v1) ────────────────────────────

export const privacyService = {
  ensurePrivacyNetwork(req: Partial<EnsurePrivacyNetworkRequest> = {}) {
    return grpcUnary<EnsurePrivacyNetworkRequest, EnsurePrivacyNetworkResponse>(
      "operation.privacy.v1.PrivacyNetworkService",
      "EnsurePrivacyNetwork",
      {
        domain: req.domain ?? "",
        forceReprovision: req.forceReprovision ?? false,
      },
    );
  },

  getNetworkStatus(req: Partial<GetNetworkStatusRequest> = {}) {
    return grpcUnary<GetNetworkStatusRequest, GetNetworkStatusResponse>(
      "operation.privacy.v1.PrivacyNetworkService",
      "GetNetworkStatus",
      {
        component: req.component ?? "all",
      },
    );
  },

  provisionUser(req: ProvisionUserRequest) {
    return grpcUnary<ProvisionUserRequest, ProvisionUserResponse>(
      "operation.privacy.v1.PrivacyNetworkService",
      "ProvisionUser",
      req,
    );
  },

  getPrivacyWireGuardConfig(req: GetPrivacyWireGuardConfigRequest) {
    return grpcUnary<
      GetPrivacyWireGuardConfigRequest,
      GetPrivacyWireGuardConfigResponse
    >(
      "operation.privacy.v1.PrivacyNetworkService",
      "GetPrivacyWireGuardConfig",
      req,
    );
  },

  manageComponent(req: ManageComponentRequest) {
    return grpcUnary<ManageComponentRequest, ManageComponentResponse>(
      "operation.privacy.v1.PrivacyNetworkService",
      "ManageComponent",
      req,
    );
  },

  getNetworkTopology(req: Partial<GetNetworkTopologyRequest> = {}) {
    return grpcUnary<GetNetworkTopologyRequest, GetNetworkTopologyResponse>(
      "operation.privacy.v1.PrivacyNetworkService",
      "GetNetworkTopology",
      {
        includeDetails: req.includeDetails ?? true,
      },
    );
  },

  healthCheck(req: Partial<HealthCheckRequest> = {}) {
    return grpcUnary<HealthCheckRequest, HealthCheckResponse>(
      "operation.privacy.v1.PrivacyNetworkService",
      "HealthCheck",
      {
        checkWgcf: req.checkWgcf ?? true,
        checkOvs: req.checkOvs ?? true,
        checkXray: req.checkXray ?? true,
        checkPorts: req.checkPorts ?? true,
      },
    );
  },

  configurePacketRouting(req: ConfigurePacketRoutingRequest) {
    return grpcUnary<
      ConfigurePacketRoutingRequest,
      ConfigurePacketRoutingResponse
    >(
      "operation.privacy.v1.PrivacyNetworkService",
      "ConfigurePacketRouting",
      req,
    );
  },

  generateWireGuardKeyPair(req: GenerateWireGuardKeyPairRequest) {
    return grpcUnary<
      GenerateWireGuardKeyPairRequest,
      GenerateWireGuardKeyPairResponse
    >(
      "operation.privacy.v1.PrivacyNetworkService",
      "GenerateWireGuardKeyPair",
      req,
    );
  },
};

// ── RegistrationService (operation.registration.v1) ─────────────────────────

export const registrationService = {
  sendMagicLink(req: SendMagicLinkRequest) {
    return grpcUnary<SendMagicLinkRequest, SendMagicLinkResponse>(
      "operation.registration.v1.RegistrationService",
      "SendMagicLink",
      req,
    );
  },

  verifyMagicLink(req: VerifyMagicLinkRequest) {
    return grpcUnary<VerifyMagicLinkRequest, VerifyMagicLinkResponse>(
      "operation.registration.v1.RegistrationService",
      "VerifyMagicLink",
      req,
    );
  },

  registerUser(req: RegisterUserRequest) {
    return grpcUnary<RegisterUserRequest, RegisterUserResponse>(
      "operation.registration.v1.RegistrationService",
      "RegisterUser",
      req,
    );
  },

  getUserStatus(req: GetUserStatusRequest) {
    return grpcUnary<GetUserStatusRequest, GetUserStatusResponse>(
      "operation.registration.v1.RegistrationService",
      "GetUserStatus",
      req,
    );
  },

  listUsers(req: Partial<ListUsersRequest> = {}) {
    return grpcUnary<ListUsersRequest, ListUsersResponse>(
      "operation.registration.v1.RegistrationService",
      "ListUsers",
      {
        limit: req.limit ?? 100,
        offset: req.offset ?? 0,
        includeAdminsOnly: req.includeAdminsOnly ?? false,
        domainFilter: req.domainFilter ?? "",
      },
    );
  },

  getWireGuardConfig(req: GetWireGuardConfigRequest) {
    return grpcUnary<GetWireGuardConfigRequest, GetWireGuardConfigResponse>(
      "operation.registration.v1.RegistrationService",
      "GetWireGuardConfig",
      req,
    );
  },

  adminUserAction(req: AdminUserActionRequest) {
    return grpcUnary<AdminUserActionRequest, AdminUserActionResponse>(
      "operation.registration.v1.RegistrationService",
      "AdminUserAction",
      req,
    );
  },
};

// ── ServiceManager (opdbus.services.v1) ─────────────────────────────────────

export const serviceManager = {
  start(name: string) {
    return grpcUnary<{ name: string }, { status: ServiceStatus }>(
      "opdbus.services.v1.ServiceManager",
      "Start",
      { name },
    );
  },

  stop(name: string) {
    return grpcUnary<{ name: string }, { status: ServiceStatus }>(
      "opdbus.services.v1.ServiceManager",
      "Stop",
      { name },
    );
  },

  restart(name: string) {
    return grpcUnary<{ name: string }, { status: ServiceStatus }>(
      "opdbus.services.v1.ServiceManager",
      "Restart",
      { name },
    );
  },

  reload(name: string) {
    return grpcUnary<{ name: string }, { status: ServiceStatus }>(
      "opdbus.services.v1.ServiceManager",
      "Reload",
      { name },
    );
  },

  create(service: ServiceDef) {
    return grpcUnary<{ service: ServiceDef }, { service: ServiceDef }>(
      "opdbus.services.v1.ServiceManager",
      "Create",
      { service },
    );
  },

  delete(name: string) {
    return grpcUnary<{ name: string }, Record<string, never>>(
      "opdbus.services.v1.ServiceManager",
      "Delete",
      { name },
    );
  },

  get(name: string) {
    return grpcUnary<{ name: string }, GetServiceResponse>(
      "opdbus.services.v1.ServiceManager",
      "Get",
      { name },
    );
  },

  list(filter = "") {
    return grpcUnary<{ filter: string }, SvcMgrListResponse>(
      "opdbus.services.v1.ServiceManager",
      "List",
      { filter },
    );
  },

  enable(name: string) {
    return grpcUnary<{ name: string }, Record<string, never>>(
      "opdbus.services.v1.ServiceManager",
      "Enable",
      { name },
    );
  },

  disable(name: string) {
    return grpcUnary<{ name: string }, Record<string, never>>(
      "opdbus.services.v1.ServiceManager",
      "Disable",
      { name },
    );
  },

  watchStatus(req: Partial<WatchServicesRequest> = {}) {
    return grpcServerStream<WatchServicesRequest, ServiceEvent>(
      "opdbus.services.v1.ServiceManager",
      "WatchStatus",
      {
        names: req.names ?? [],
      },
    );
  },
};

// ── McpService (op.mcp.v1) ──────────────────────────────────────────────────

export const mcpService = {
  health() {
    return grpcUnary<Record<string, never>, McpHealthResponse>(
      "op.mcp.v1.McpService",
      "Health",
      {},
    );
  },

  initialize(req: Partial<InitializeRequest> = {}) {
    return grpcUnary<InitializeRequest, InitializeResponse>(
      "op.mcp.v1.McpService",
      "Initialize",
      {
        clientName: req.clientName ?? "web-ui",
        capabilities: req.capabilities ?? [],
      },
    );
  },

  listTools(req: Partial<ListToolsRequest> = {}) {
    return grpcUnary<ListToolsRequest, McpListToolsResponse>(
      "op.mcp.v1.McpService",
      "ListTools",
      {
        limit: req.limit ?? 100,
        offset: req.offset ?? 0,
      },
    );
  },

  callTool(req: CallToolRequest) {
    return grpcUnary<CallToolRequest, CallToolResponse>(
      "op.mcp.v1.McpService",
      "CallTool",
      req,
    );
  },

  callToolStreaming(req: CallToolRequest) {
    return grpcServerStream<CallToolRequest, ToolOutput>(
      "op.mcp.v1.McpService",
      "CallToolStreaming",
      req,
    );
  },

  subscribe(req: Partial<McpSubscribeRequest> = {}) {
    return grpcServerStream<McpSubscribeRequest, McpEvent>(
      "op.mcp.v1.McpService",
      "Subscribe",
      {
        eventTypes: req.eventTypes ?? [],
      },
    );
  },
};

// ── ChatbotAccountabilityService (operation.accountability.v1) ──────────────

export const accountabilityService = {
  searchEpisodes(req: SearchEpisodesRequest) {
    return grpcUnary<SearchEpisodesRequest, SearchEpisodesResponse>(
      "operation.accountability.v1.ChatbotAccountabilityService",
      "SearchEpisodes",
      {
        query: req.query,
        outcomeClass: req.outcomeClass ?? "",
        pluginId: req.pluginId ?? "",
        conversationId: req.conversationId ?? "",
        timeRangeStart: req.timeRangeStart ?? "",
        timeRangeEnd: req.timeRangeEnd ?? "",
        limit: req.limit ?? 20,
      },
    );
  },

  getEpisode(req: GetEpisodeRequest) {
    return grpcUnary<GetEpisodeRequest, GetEpisodeResponse>(
      "operation.accountability.v1.ChatbotAccountabilityService",
      "GetEpisode",
      req,
    );
  },

  getCollectionStats() {
    return grpcUnary<Record<string, never>, CollectionStatsResponse>(
      "operation.accountability.v1.ChatbotAccountabilityService",
      "GetCollectionStats",
      {},
    );
  },

  chatWithContext(req: ChatWithContextRequest) {
    return grpcUnary<ChatWithContextRequest, ChatWithContextResponse>(
      "operation.accountability.v1.ChatbotAccountabilityService",
      "ChatWithContext",
      req,
    );
  },

  subscribeEpisodes(req: Partial<SubscribeEpisodesRequest> = {}) {
    return grpcServerStream<SubscribeEpisodesRequest, EpisodeEvent>(
      "operation.accountability.v1.ChatbotAccountabilityService",
      "SubscribeEpisodes",
      {
        pluginId: req.pluginId ?? "",
        outcomeClassFilter: req.outcomeClassFilter ?? "",
        includeExisting: req.includeExisting ?? false,
      },
    );
  },

  getPiiPolicy() {
    return grpcUnary<Record<string, never>, GetPiiPolicyResponse>(
      "operation.accountability.v1.ChatbotAccountabilityService",
      "GetPiiPolicy",
      {},
    );
  },
};

// ── BlockchainService (operation.blockchain.v1) ─────────────────────────────

export const blockchainService = {
  getFootprints(req: Partial<GetFootprintsRequest> = {}) {
    return grpcUnary<GetFootprintsRequest, GetFootprintsResponse>(
      "operation.blockchain.v1.BlockchainService",
      "GetFootprints",
      {
        fromIndex: req.fromIndex ?? 0,
        toIndex: req.toIndex ?? 0,
        limit: req.limit ?? 100,
        pluginId: req.pluginId ?? "",
      },
    );
  },

  verifyChain(req: Partial<VerifyBlockchainRequest> = {}) {
    return grpcUnary<VerifyBlockchainRequest, VerifyBlockchainResponse>(
      "operation.blockchain.v1.BlockchainService",
      "VerifyChain",
      {
        fromIndex: req.fromIndex ?? 0,
        toIndex: req.toIndex ?? 0,
      },
    );
  },

  getEmbeddingQueueStatus() {
    return grpcUnary<Record<string, never>, GetEmbeddingQueueStatusResponse>(
      "operation.blockchain.v1.BlockchainService",
      "GetEmbeddingQueueStatus",
      {},
    );
  },

  getQdrantRoles() {
    return grpcUnary<Record<string, never>, GetQdrantRolesResponse>(
      "operation.blockchain.v1.BlockchainService",
      "GetQdrantRoles",
      {},
    );
  },
};

// ── BtrfsService (operation.btrfs.v1) ───────────────────────────────────────

export const btrfsService = {
  getSubvolumes() {
    return grpcUnary<Record<string, never>, GetSubvolumesResponse>(
      "operation.btrfs.v1.BtrfsService",
      "GetSubvolumes",
      {},
    );
  },

  getSnapshots(req: Partial<BtrfsGetSnapshotsRequest> = {}) {
    return grpcUnary<BtrfsGetSnapshotsRequest, BtrfsGetSnapshotsResponse>(
      "operation.btrfs.v1.BtrfsService",
      "GetSnapshots",
      {
        subvolume: req.subvolume ?? "",
        limit: req.limit ?? 50,
      },
    );
  },

  getSendState() {
    return grpcUnary<Record<string, never>, GetSendStateResponse>(
      "operation.btrfs.v1.BtrfsService",
      "GetSendState",
      {},
    );
  },

  getDrStatus() {
    return grpcUnary<Record<string, never>, GetDrStatusResponse>(
      "operation.btrfs.v1.BtrfsService",
      "GetDrStatus",
      {},
    );
  },
};

// ── PersonaService (operation.agents.v1) ────────────────────────────────────

export const personaService = {
  listPersonas() {
    return grpcUnary<Record<string, never>, ListPersonasResponse>(
      "operation.agents.v1.PersonaService",
      "ListPersonas",
      {},
    );
  },

  getPersona(req: GetPersonaRequest) {
    return grpcUnary<GetPersonaRequest, GetPersonaResponse>(
      "operation.agents.v1.PersonaService",
      "GetPersona",
      req,
    );
  },

  createPersona(req: CreatePersonaRequest) {
    return grpcUnary<CreatePersonaRequest, CreatePersonaResponse>(
      "operation.agents.v1.PersonaService",
      "CreatePersona",
      req,
    );
  },

  updatePersona(req: UpdatePersonaRequest) {
    return grpcUnary<UpdatePersonaRequest, UpdatePersonaResponse>(
      "operation.agents.v1.PersonaService",
      "UpdatePersona",
      req,
    );
  },

  deletePersona(req: DeletePersonaRequest) {
    return grpcUnary<DeletePersonaRequest, DeletePersonaResponse>(
      "operation.agents.v1.PersonaService",
      "DeletePersona",
      req,
    );
  },

  listAgentRoutes() {
    return grpcUnary<Record<string, never>, ListAgentRoutesResponse>(
      "operation.agents.v1.PersonaService",
      "ListAgentRoutes",
      {},
    );
  },
};

// ── DataStoreService (operation.stores.v1) ──────────────────────────────────

export const dataStoreService = {
  getDataStores() {
    return grpcUnary<Record<string, never>, GetDataStoresResponse>(
      "operation.stores.v1.DataStoreService",
      "GetDataStores",
      {},
    );
  },

  getStoreDetail(req: GetStoreDetailRequest) {
    return grpcUnary<GetStoreDetailRequest, GetStoreDetailResponse>(
      "operation.stores.v1.DataStoreService",
      "GetStoreDetail",
      req,
    );
  },
};

// ── EmbeddingService (operation.embedding.v1) ───────────────────────────────

export const embeddingService = {
  getQueue(req: Partial<GetEmbeddingQueueRequest> = {}) {
    return grpcUnary<GetEmbeddingQueueRequest, GetEmbeddingQueueResponse>(
      "operation.embedding.v1.EmbeddingService",
      "GetQueue",
      {
        limit: req.limit ?? 50,
        statusFilter: req.statusFilter ?? "",
      },
    );
  },

  getWorkerStatus() {
    return grpcUnary<Record<string, never>, GetEmbeddingWorkerStatusResponse>(
      "operation.embedding.v1.EmbeddingService",
      "GetWorkerStatus",
      {},
    );
  },

  previewEmbeddingText(req: PreviewEmbeddingTextRequest) {
    return grpcUnary<PreviewEmbeddingTextRequest, PreviewEmbeddingTextResponse>(
      "operation.embedding.v1.EmbeddingService",
      "PreviewEmbeddingText",
      req,
    );
  },

  getChannelDiagnostics() {
    return grpcUnary<Record<string, never>, GetChannelDiagnosticsResponse>(
      "operation.embedding.v1.EmbeddingService",
      "GetChannelDiagnostics",
      {},
    );
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// D-BUS PASSTHROUGH SERVICE (operation.v1.DbusPassthrough)
// ═══════════════════════════════════════════════════════════════════════════

export const dbusPassthrough = {
  call(req: {
    bus: string;
    destination: string;
    path: string;
    interface: string;
    method: string;
    jsonBody: string;
  }) {
    return grpcUnary<
      {
        bus: string;
        destination: string;
        path: string;
        interface: string;
        method: string;
        json_body: string;
      },
      { success: boolean; json_result: string; error: string }
    >("operation.v1.DbusPassthrough", "Call", {
      bus: req.bus,
      destination: req.destination,
      path: req.path,
      interface: req.interface,
      method: req.method,
      json_body: req.jsonBody,
    });
  },

  get(req: {
    bus: string;
    destination: string;
    path: string;
    interface: string;
    property: string;
  }) {
    return grpcUnary<
      {
        bus: string;
        destination: string;
        path: string;
        interface: string;
        property: string;
      },
      { success: boolean; json_value: string; error: string }
    >("operation.v1.DbusPassthrough", "Get", req);
  },

  set(req: {
    bus: string;
    destination: string;
    path: string;
    interface: string;
    property: string;
    json_value: string;
  }) {
    return grpcUnary<
      {
        bus: string;
        destination: string;
        path: string;
        interface: string;
        property: string;
        json_value: string;
      },
      { success: boolean; error: string }
    >("operation.v1.DbusPassthrough", "Set", req);
  },

  watch(req: {
    bus: string;
    destination: string;
    path: string;
    interface: string;
    signal_names?: string[];
  }) {
    return grpcServerStream<
      {
        bus: string;
        destination: string;
        path: string;
        interface: string;
        signal_names: string[];
      },
      {
        signal_name: string;
        path: string;
        interface: string;
        json_body: string;
        timestamp?: { seconds: number; nanos: number };
      }
    >("operation.v1.DbusPassthrough", "Watch", {
      bus: req.bus,
      destination: req.destination,
      path: req.path,
      interface: req.interface,
      signal_names: req.signal_names ?? [],
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ASSISTANT SERVICES (via D-Bus passthrough → ai.assistant.v1)
// ═══════════════════════════════════════════════════════════════════════════

import type {
  SoulMemory,
  GetSoulMemoryRequest,
  UpdateSoulMemoryRequest,
  ListSoulMemoriesRequest,
  ListSoulMemoriesResponse,
} from "./gen/assistant/soul";

import type {
  MemoryEntry,
  ReadMemoryRequest,
  ReadMemoryResponse,
  WriteMemoryRequest,
  WriteMemoryResponse,
  SearchMemoryRequest,
  SearchMemoryResponse,
  MemoryStats,
} from "./gen/assistant/memory";

import type {
  MemoryNamespace,
  SetMemoryNamespaceRequest,
  ListMemoryNamespacesResponse,
} from "./gen/assistant/namespace";

import type {
  Agent,
  ListAgentsResponse,
  Run,
  StartRunRequest,
} from "./gen/assistant/agent";

import type {
  ListSessionsResponse,
  CreateSessionRequest,
  Message as SessionMessage,
  SendMessageRequest,
  GetSessionHistoryRequest,
  SessionHistory,
} from "./gen/assistant/session";

import type {
  ListCronJobsResponse,
  CreateCronJobRequest,
  CronJob,
} from "./gen/assistant/cron";

const ASSISTANT_BUS = "session";
const ASSISTANT_DEST = "ai.assistant.v1";
const ASSISTANT_PATH = "/ai/assistant";
const ASSISTANT_IFACE = "ai.assistant.v1";

async function assistantCall(method: string, body: unknown): Promise<unknown> {
  const resp = await dbusPassthrough.call({
    bus: ASSISTANT_BUS,
    destination: ASSISTANT_DEST,
    path: ASSISTANT_PATH,
    interface: ASSISTANT_IFACE,
    method,
    jsonBody: JSON.stringify(body),
  });
  if (!resp.success) {
    throw new Error(`Assistant D-Bus call '${method}' failed: ${resp.error}`);
  }
  return JSON.parse(resp.json_result);
}

export const assistantService = {
  // ── Soul ────────────────────────────────────────────────────────────────
  getSoulMemory(req: GetSoulMemoryRequest): Promise<SoulMemory> {
    return assistantCall("GetSoulMemory", req) as Promise<SoulMemory>;
  },
  updateSoulMemory(req: UpdateSoulMemoryRequest): Promise<SoulMemory> {
    return assistantCall("UpdateSoulMemory", req) as Promise<SoulMemory>;
  },
  deleteSoulMemory(agentId: string): Promise<void> {
    return assistantCall("DeleteSoulMemory", { agent_id: agentId }).then(
      () => {},
    );
  },
  listSoulMemories(
    req?: Partial<ListSoulMemoriesRequest>,
  ): Promise<ListSoulMemoriesResponse> {
    return assistantCall(
      "ListSoulMemories",
      req ?? {},
    ) as Promise<ListSoulMemoriesResponse>;
  },

  // ── Namespace ────────────────────────────────────────────────────────────
  getMemoryNamespace(agentId: string): Promise<MemoryNamespace> {
    return assistantCall("GetMemoryNamespace", {
      agent_id: agentId,
    }) as Promise<MemoryNamespace>;
  },
  setMemoryNamespace(req: SetMemoryNamespaceRequest): Promise<MemoryNamespace> {
    return assistantCall("SetMemoryNamespace", req) as Promise<MemoryNamespace>;
  },
  clearMemoryNamespace(agentId: string): Promise<void> {
    return assistantCall("ClearMemoryNamespace", { agent_id: agentId }).then(
      () => {},
    );
  },
  listMemoryNamespaces(): Promise<ListMemoryNamespacesResponse> {
    return assistantCall(
      "ListMemoryNamespaces",
      {},
    ) as Promise<ListMemoryNamespacesResponse>;
  },

  // ── Memory ───────────────────────────────────────────────────────────────
  readMemory(req: ReadMemoryRequest): Promise<ReadMemoryResponse> {
    return assistantCall("ReadMemory", req) as Promise<ReadMemoryResponse>;
  },
  writeMemory(req: WriteMemoryRequest): Promise<WriteMemoryResponse> {
    return assistantCall("WriteMemory", req) as Promise<WriteMemoryResponse>;
  },
  deleteMemory(
    namespace: string,
    keys: string[],
  ): Promise<{ deleted: number }> {
    return assistantCall("DeleteMemory", { namespace, keys }) as Promise<{
      deleted: number;
    }>;
  },
  searchMemory(req: SearchMemoryRequest): Promise<SearchMemoryResponse> {
    return assistantCall("SearchMemory", req) as Promise<SearchMemoryResponse>;
  },
  getMemoryStats(namespace: string): Promise<MemoryStats> {
    return assistantCall("GetMemoryStats", {
      namespace,
    }) as Promise<MemoryStats>;
  },

  // ── Agents ──────────────────────────────────────────────────────────────
  listAgents(): Promise<ListAgentsResponse> {
    return assistantCall("ListAgents", {}) as Promise<ListAgentsResponse>;
  },
  getAgent(id: string): Promise<Agent> {
    return assistantCall("GetAgent", { id }) as Promise<Agent>;
  },
  startRun(req: StartRunRequest): Promise<Run> {
    return assistantCall("StartRun", req) as Promise<Run>;
  },

  // ── Sessions ─────────────────────────────────────────────────────────────
  listSessions(agentId?: string): Promise<ListSessionsResponse> {
    return assistantCall("ListSessions", {
      agent_id: agentId ?? "",
    }) as Promise<ListSessionsResponse>;
  },
  createSession(req: CreateSessionRequest): Promise<{ id: string }> {
    return assistantCall("CreateSession", req) as Promise<{ id: string }>;
  },
  getSessionHistory(req: GetSessionHistoryRequest): Promise<SessionHistory> {
    return assistantCall("GetSessionHistory", req) as Promise<SessionHistory>;
  },
  sendMessage(req: SendMessageRequest): Promise<SessionMessage> {
    return assistantCall("SendMessage", req) as Promise<SessionMessage>;
  },

  // ── Cron ─────────────────────────────────────────────────────────────────
  listCronJobs(): Promise<ListCronJobsResponse> {
    return assistantCall("ListCronJobs", {}) as Promise<ListCronJobsResponse>;
  },
  createCronJob(req: CreateCronJobRequest): Promise<CronJob> {
    return assistantCall("CreateCronJob", req) as Promise<CronJob>;
  },
  deleteCronJob(id: string): Promise<void> {
    return assistantCall("DeleteCronJob", { id }).then(() => {});
  },
  triggerCronJob(id: string): Promise<void> {
    return assistantCall("TriggerCronJob", { id }).then(() => {});
  },
};
