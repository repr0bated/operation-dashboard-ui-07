/**
 * Typed API client for the operation-dbus gateway.
 * Unary RPCs use gRPC-Web; streaming is handled by use-event-stream.
 * Falls back to REST for endpoints not yet ported to gRPC.
 *
 * @see docs/architecture-flow.md for the full service topology.
 */
import {
  stateSync,
  pluginService,
  eventChainService,
  componentRegistry,
  mailService,
  privacyService,
  registrationService,
} from "@/grpc/client";
import { pluginMethods } from "@/grpc/plugin-methods";
import { hostRuntime } from "@/grpc/host-runtime";
import { jsObjectToValue, structToObject, valueToJs } from "@/grpc/google/protobuf/struct";

import type {
  HealthSnapshot, StatusSummary, DbusService, Tool, Agent, Session,
  ChatMessage, LogEntry, ConfigSnapshot, LlmProvider, LlmModel,
} from "@/types/api";

/**
 * REST base URL resolution (mirrors src/grpc/client.ts):
 *   1. Runtime override:  window.__OPDBUS_CONFIG__.apiBaseUrl
 *   2. Build-time env:    VITE_API_BASE_URL
 *   3. Same-origin:       "/api"
 */
export function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__OPDBUS_CONFIG__?.apiBaseUrl;
    if (runtime) return runtime.replace(/\/+$/, "");
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  return "/api";
}

const BASE = resolveApiBase();

/** Map any REST failure to a generic, user-safe message; log details to console only. */
function safeApiError(path: string, status: number, body: string): Error {
  // eslint-disable-next-line no-console
  console.error("[api] call failed", { path, status, body });
  if (status === 401) return new Error("Authentication required.");
  if (status === 403) return new Error("You do not have access to this resource.");
  if (status === 429) return new Error("Too many requests — please slow down.");
  if (status >= 500) return new Error("Service unavailable — try again.");
  return new Error("Request failed — try again.");
}

/**
 * REST fallback for endpoints not yet gRPC-ified.
 *
 * Auth: identity is the caller's WireGuard public key, enforced at the
 * network layer (WG mesh termination) and re-validated in op-web against
 * the identity sled. No bearer tokens are attached client-side.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Lazy import avoids circular deps with grpc client at module load.
  const { identityHeaders } = await import("@/lib/identity");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...identityHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    throw safeApiError(path, res.status, body);
  }
  return res.json();
}

export const api = {
  // ── gRPC-powered endpoints (bridge services) ───────────────────────────

  /** Get full state snapshot via gRPC StateSync.GetState */
  state: async (pluginId = "", objectPath = "") => {
    const resp = await stateSync.getState({ pluginId, objectPath });
    return structToObject(resp.state as unknown as Record<string, unknown>);
  },

  /** Mutate state via gRPC StateSync.Mutate */
  mutate: stateSync.mutate,
  batchMutate: stateSync.batchMutate,

  /** Plugin operations via gRPC PluginService */
  plugins: {
    list: async () => {
      const resp = await pluginService.listPlugins();
      return resp.plugins;
    },
    getSchema: pluginService.getSchema,
    callMethod: pluginService.callMethod,
    getProperty: pluginService.getProperty,
    setProperty: pluginService.setProperty,
  },

  /** Event chain / audit via gRPC EventChainService */
  eventChain: {
    getEvents: eventChainService.getEvents,
    verifyChain: eventChainService.verifyChain,
    getProof: eventChainService.getProof,
    proveTagImmutability: eventChainService.proveTagImmutability,
    getSnapshot: eventChainService.getSnapshot,
    createSnapshot: eventChainService.createSnapshot,
  },

  /** OVSDB via ovsdb_bridge / rovs_commands plugins */
  ovs: {
    listDbs: () => pluginMethods.callSubid("obs.network.ovsdb.dbs.list@v1", {}),
    getSchema: (database: string) =>
      pluginMethods.callSubid("obs.network.ovsdb.schema.get@v1", { database }),
    transact: (operations: unknown[]) =>
      pluginMethods.callSubid("mut.network.ovsdb.transact@v1", { operations }),
    echo: (message: string) =>
      pluginMethods.callSubid("obs.network.ovsdb.echo@v1", { message }),
    getBridgeState: async (bridgeName = "") => {
      const bridges = await pluginMethods.callSubid<{ bridges?: string[] }>(
        "obs.network.ovsdb.bridge.list@v1",
        {},
      );
      const names = Array.isArray(bridges.bridges) ? bridges.bridges : [];
      const filtered = bridgeName ? names.filter((n) => n === bridgeName) : names;
      const ports = await Promise.all(
        filtered.map(async (name) => {
          try {
            return {
              bridge: name,
              ...(await pluginMethods.callSubid("obs.network.ovsdb.port.list@v1", { bridgeName: name })),
            };
          } catch (e) {
            return { bridge: name, error: (e as Error).message };
          }
        }),
      );
      return { bridges, ports };
    },
    dumpDb: () => {
      throw new Error("dumpDb removed — use ovs.transact or ovsdb_bridge plugin methods");
    },
  },

  /** Host runtime reads via host_runtime plugin */
  runtime: {
    getSystemInfo: hostRuntime.getSystemInfo,
    listServices: hostRuntime.listServices,
    getService: hostRuntime.getService,
    listInterfaces: hostRuntime.listInterfaces,
    getNumaTopology: hostRuntime.getNumaTopology,
    sampleMetrics: hostRuntime.sampleMetrics,
  },

  /** Component registry via gRPC */
  registry: {
    discover: componentRegistry.discover,
    getComponent: componentRegistry.getComponent,
  },

  // ── gRPC domain services ───────────────────────────────────────────────

  /** Mail service (operation.mail.v1) */
  mail: {
    sendEmail: mailService.sendEmail,
    getInbox: mailService.getInbox,
    getMessage: mailService.getMessage,
    getMailStatus: mailService.getMailStatus,
    listAccounts: mailService.listMailAccounts,
    adminAction: mailService.adminMailAction,
    checkServer: mailService.checkMailServer,
  },

  /** Privacy network (operation.privacy.v1) */
  privacy: {
    ensureNetwork: privacyService.ensurePrivacyNetwork,
    getStatus: privacyService.getNetworkStatus,
    provisionUser: privacyService.provisionUser,
    getWireGuardConfig: privacyService.getPrivacyWireGuardConfig,
    manageComponent: privacyService.manageComponent,
    getTopology: privacyService.getNetworkTopology,
    healthCheck: privacyService.healthCheck,
    configureRouting: privacyService.configurePacketRouting,
    generateKeyPair: privacyService.generateWireGuardKeyPair,
  },

  /** Registration (operation.registration.v1) */
  registration: {
    sendMagicLink: registrationService.sendMagicLink,
    verifyMagicLink: registrationService.verifyMagicLink,
    registerUser: registrationService.registerUser,
    getUserStatus: registrationService.getUserStatus,
    listUsers: registrationService.listUsers,
    getWireGuardConfig: registrationService.getWireGuardConfig,
    adminAction: registrationService.adminUserAction,
  },

  /** MCP via cognitive_mcp plugin (not legacy op.mcp.v1). */
  mcp: {
    health: async () => {
      const resp = await pluginService.callMethod({
        pluginId: "cognitive_mcp",
        objectPath: "/org/opdbus/v1/plugins/cognitive_mcp",
        interfaceName: "org.opdbus.v1.PluginV1",
        methodName: "get_health",
        arguments: [jsObjectToValue({})],
        actorId: "operation-dashboard-ui",
        capabilityId: "cognitive_mcp.read",
      });
      const envelope = structToObject(resp.result as Record<string, unknown>);
      return valueToJs(envelope.result) ?? envelope;
    },
    listTools: async () => {
      const resp = await pluginService.callMethod({
        pluginId: "cognitive_mcp",
        objectPath: "/org/opdbus/v1/plugins/cognitive_mcp",
        interfaceName: "org.opdbus.v1.PluginV1",
        methodName: "list_tools",
        arguments: [jsObjectToValue({})],
        actorId: "operation-dashboard-ui",
        capabilityId: "cognitive_mcp.read",
      });
      const envelope = structToObject(resp.result as Record<string, unknown>);
      return valueToJs(envelope.result) ?? envelope;
    },
    callTool: async (name: string, args: Record<string, unknown> = {}) => {
      const resp = await pluginService.callMethod({
        pluginId: "cognitive_mcp",
        objectPath: "/org/opdbus/v1/plugins/cognitive_mcp",
        interfaceName: "org.opdbus.v1.PluginV1",
        methodName: "invoke_tool",
        arguments: [jsObjectToValue({ tool_name: name, arguments: args })],
        actorId: "operation-dashboard-ui",
        capabilityId: "cognitive_mcp.invoke",
      });
      const envelope = structToObject(resp.result as Record<string, unknown>);
      if (envelope.success === false) {
        throw new Error(
          typeof envelope.error === "object" && envelope.error && "message" in envelope.error
            ? String((envelope.error as { message?: unknown }).message)
            : "cognitive_mcp invoke_tool failed",
        );
      }
      return valueToJs(envelope.result) ?? envelope;
    },
  },

  // ── REST fallbacks (not yet ported to gRPC) ─────────────────────────────

  health: () => request<HealthSnapshot>("/health"),
  status: () => request<StatusSummary>("/status"),

  services: {
    list: () => request<DbusService[]>("/services"),
    get: (name: string) => request<DbusService>(`/services/${encodeURIComponent(name)}`),
    introspect: (name: string, path: string) =>
      request<unknown>(`/services/${encodeURIComponent(name)}/introspect?path=${encodeURIComponent(path)}`),
    call: (name: string, path: string, iface: string, method: string, args: unknown[] = []) =>
      request<unknown>(`/services/${encodeURIComponent(name)}/call`, {
        method: "POST", body: JSON.stringify({ path, interface: iface, method, args }),
      }),
  },

  tools: {
    list: () => request<Tool[]>("/tools"),
    get: (id: string) => request<Tool>(`/tools/${encodeURIComponent(id)}`),
    execute: (id: string, input: Record<string, unknown>) =>
      request<unknown>(`/tools/${encodeURIComponent(id)}/execute`, {
        method: "POST", body: JSON.stringify(input),
      }),
  },

  agents: {
    list: () => request<Agent[]>("/agents"),
    get: (id: string) => request<Agent>(`/agents/${id}`),
    start: (id: string) => request<void>(`/agents/${id}/start`, { method: "POST" }),
    stop: (id: string) => request<void>(`/agents/${id}/stop`, { method: "POST" }),
  },

  llm: {
    status: () => request<LlmProvider[]>("/llm/status"),
    models: () => request<LlmModel[]>("/llm/models"),
    setModel: (modelId: string) => request<void>("/llm/model", {
      method: "POST", body: JSON.stringify({ modelId }),
    }),
  },

  sessions: {
    list: () => request<Session[]>("/sessions"),
    get: (key: string) => request<Session>(`/sessions/${encodeURIComponent(key)}`),
    delete: (key: string) => request<void>(`/sessions/${encodeURIComponent(key)}`, { method: "DELETE" }),
    patch: (key: string, patch: Record<string, unknown>) =>
      request<void>(`/sessions/${encodeURIComponent(key)}`, {
        method: "PATCH", body: JSON.stringify(patch),
      }),
  },

  chat: {
    /** GET /api/chat/history/:session_id → { session_id, messages: [{ role, content }] } */
    history: (sessionId: string) =>
      request<{ session_id: string; messages: Array<{ role: string; content: unknown }> }>(
        `/chat/history/${encodeURIComponent(sessionId)}`,
      ),
    /** POST /api/chat → { success, message, error, tools_executed, session_id, model, provider } */
    send: (sessionId: string, message: string) =>
      request<{
        success: boolean;
        message: unknown;
        error?: string | null;
        tools_executed?: unknown;
        session_id: string;
        model?: string;
        provider?: string;
      }>(`/chat`, {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, message }),
      }),
    /** POST /api/chat/sessions → { id, title, created_at, updated_at, message_count } */
    createSession: (title?: string) =>
      request<{
        id: string;
        title: string;
        created_at: string;
        updated_at: string;
        message_count: number;
      }>(`/chat/sessions`, {
        method: "POST",
        body: JSON.stringify(title ? { title } : {}),
      }),
  },

  logs: {
    list: (opts?: { limit?: number; level?: string }) => {
      const p = new URLSearchParams();
      if (opts?.limit) p.set("limit", String(opts.limit));
      if (opts?.level) p.set("level", opts.level);
      return request<LogEntry[]>(`/logs?${p}`);
    },
  },

  config: {
    get: () => request<ConfigSnapshot>("/config"),
    save: (config: Record<string, unknown>) =>
      request<void>("/config", { method: "PUT", body: JSON.stringify(config) }),
    apply: () => request<void>("/config/apply", { method: "POST" }),
  },

  debug: {
    call: (method: string, params: unknown) =>
      request<unknown>("/debug/call", {
        method: "POST", body: JSON.stringify({ method, params }),
      }),
  },
};

/**
 * @deprecated Use `useEventStream()` hook instead — SSE has been replaced by gRPC-Web streams.
 */
export function connectEventStream(
  onEvent: (event: { type: string; data: unknown }) => void,
  onError: (err: Error) => void,
): () => void {
  console.warn("[DEPRECATED] connectEventStream: SSE has been replaced by gRPC-Web. Use useEventStream() hook.");
  return () => {};
}
