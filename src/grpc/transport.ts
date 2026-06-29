/**
 * gRPC-Web transport singleton + typed client factories.
 *
 * Centralises the `GrpcWebFetchTransport` (binary `application/grpc-web+proto`
 * framing) and exposes one `getXxxClient()` factory per generated service.
 * Call sites should consume these factories instead of hand-rolled JSON
 * fetch helpers in `client.ts`.
 *
 * Auth: identity = caller's WireGuard pubkey, enforced at the WG boundary
 * and re-validated by op-web. No bearer tokens are attached client-side.
 *
 * Base URL resolution order:
 *   1. Runtime override   – window.__OPDBUS_CONFIG__.grpcBaseUrl (op-web injected)
 *   2. Build-time env     – VITE_GRPC_BASE_URL
 *   3. Same-origin        – window.location.origin (served by gateway)
 *   4. resetTransport()   – explicit programmatic override
 */

import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";

// Generated service clients. Aliased where two .proto files declare a
// service of the same simple name so they coexist in this module.
import { StateSyncClient } from "./gen/operation.client";
import { PluginServiceClient } from "./gen/operation.client";
import { EventChainServiceClient } from "./gen/operation.client";
import { OvsdbMirrorClient } from "./gen/operation.client";
import { RuntimeMirrorClient } from "./gen/operation.client";
import { DbusPassthroughClient } from "./gen/operation.client";

import { ComponentRegistryClient } from "./gen/registry.client";

import { MailServiceClient } from "./gen/mail.client";
import { PrivacyNetworkServiceClient } from "./gen/privacy_network.client";
import { RegistrationServiceClient } from "./gen/registration.client";
import { ServiceManagerClient } from "./gen/services.client";
import { McpServiceClient as McpServiceClientV1 } from "./gen/mcp.client";
import { CacheServiceClient } from "./gen/op_cache.client";
import { ZeroclawServiceClient } from "./gen/zeroclaw.client";

import {
  AgentServiceClient,
  MemoryAgentClient,
  SequentialThinkingAgentClient,
  ContextManagerAgentClient,
  RustProAgentClient,
  BackendArchitectAgentClient,
} from "./gen/agents.client";

import {
  ChatServiceClient,
} from "./gen/chat.client";

import {
  AgentLifecycleClient as OrchestrationAgentLifecycleClient,
  AgentExecutionClient as OrchestrationAgentExecutionClient,
  MemoryServiceClient as OrchestrationMemoryServiceClient,
  SequentialThinkingServiceClient as OrchestrationSequentialThinkingServiceClient,
  ContextManagerServiceClient as OrchestrationContextManagerServiceClient,
  RustProServiceClient as OrchestrationRustProServiceClient,
  BackendArchitectServiceClient,
  WorkstackServiceClient,
} from "./gen/orchestration.client";

import {
  AgentLifecycleClient,
  AgentExecutionClient,
  MemoryServiceClient,
  SequentialThinkingServiceClient,
  ContextManagerServiceClient,
  RustProServiceClient,
} from "./gen/internal_agents.client";

// ── Base URL resolution ──────────────────────────────────────────────────────

declare global {
  interface Window {
    __OPDBUS_CONFIG__?: { grpcBaseUrl?: string; apiBaseUrl?: string };
  }
}

let _baseUrlOverride: string | null = null;

function resolveBaseUrl(): string {
  if (_baseUrlOverride !== null) return _baseUrlOverride;
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

// ── Transport singleton ──────────────────────────────────────────────────────

let _transport: GrpcWebFetchTransport | null = null;

export function getTransport(): GrpcWebFetchTransport {
  if (!_transport) {
    _transport = new GrpcWebFetchTransport({
      baseUrl: resolveBaseUrl(),
      format: "binary",
    });
  }
  return _transport;
}

/** Replace the transport (e.g. when runtime config swaps the gateway URL). */
export function resetTransport(baseUrl?: string): void {
  if (baseUrl !== undefined) _baseUrlOverride = baseUrl.replace(/\/+$/, "");
  _transport = new GrpcWebFetchTransport({
    baseUrl: resolveBaseUrl(),
    format: "binary",
  });
  // Invalidate cached service clients so they pick up the new transport.
  for (const key of Object.keys(_clientCache)) delete _clientCache[key];
}

// ── Typed client factories ───────────────────────────────────────────────────
// Each factory returns a memoised client bound to the current transport.
// `resetTransport()` clears the cache so subsequent calls get fresh clients.

const _clientCache: Record<string, unknown> = {};

function memoise<T>(key: string, build: () => T): T {
  if (!(key in _clientCache)) _clientCache[key] = build();
  return _clientCache[key] as T;
}

// operation.proto (bridge)
export const getStateSyncClient = () =>
  memoise("StateSync", () => new StateSyncClient(getTransport()));
export const getPluginServiceClient = () =>
  memoise("PluginService", () => new PluginServiceClient(getTransport()));
export const getEventChainServiceClient = () =>
  memoise("EventChainService", () => new EventChainServiceClient(getTransport()));
export const getOvsdbMirrorClient = () =>
  memoise("OvsdbMirror", () => new OvsdbMirrorClient(getTransport()));
export const getRuntimeMirrorClient = () =>
  memoise("RuntimeMirror", () => new RuntimeMirrorClient(getTransport()));
export const getDbusPassthroughClient = () =>
  memoise("DbusPassthrough", () => new DbusPassthroughClient(getTransport()));

// registry.proto
export const getComponentRegistryClient = () =>
  memoise("ComponentRegistry", () => new ComponentRegistryClient(getTransport()));

// Domain services
export const getMailServiceClient = () =>
  memoise("MailService", () => new MailServiceClient(getTransport()));
export const getPrivacyNetworkServiceClient = () =>
  memoise("PrivacyNetworkService", () => new PrivacyNetworkServiceClient(getTransport()));
export const getRegistrationServiceClient = () =>
  memoise("RegistrationService", () => new RegistrationServiceClient(getTransport()));
export const getServiceManagerClient = () =>
  memoise("ServiceManager", () => new ServiceManagerClient(getTransport()));
export const getMcpServiceClient = () =>
  memoise("McpService", () => new McpServiceClientV1(getTransport()));
export const getCacheServiceClient = () =>
  memoise("CacheService", () => new CacheServiceClient(getTransport()));
export const getZeroclawServiceClient = () =>
  memoise("ZeroclawService", () => new ZeroclawServiceClient(getTransport()));

// agents.proto (external agent personas)
export const getAgentServiceClient = () =>
  memoise("AgentService", () => new AgentServiceClient(getTransport()));
export const getMemoryAgentClient = () =>
  memoise("MemoryAgent", () => new MemoryAgentClient(getTransport()));
export const getSequentialThinkingAgentClient = () =>
  memoise("SequentialThinkingAgent", () => new SequentialThinkingAgentClient(getTransport()));
export const getContextManagerAgentClient = () =>
  memoise("ContextManagerAgent", () => new ContextManagerAgentClient(getTransport()));
export const getRustProAgentClient = () =>
  memoise("RustProAgent", () => new RustProAgentClient(getTransport()));
export const getBackendArchitectAgentClient = () =>
  memoise("BackendArchitectAgent", () => new BackendArchitectAgentClient(getTransport()));

// chat.proto — only ChatService lives here; the other agent lifecycle
// services are exposed via orchestration.proto / internal_agents.proto.
export const getChatServiceClient = () =>
  memoise("ChatService", () => new ChatServiceClient(getTransport()));

// orchestration.proto — agent lifecycle + execution + per-agent services
// running under the orchestrator package, plus BackendArchitect & Workstack.
export const getOrchestrationAgentLifecycleClient = () =>
  memoise("OrchestrationAgentLifecycle", () => new OrchestrationAgentLifecycleClient(getTransport()));
export const getOrchestrationAgentExecutionClient = () =>
  memoise("OrchestrationAgentExecution", () => new OrchestrationAgentExecutionClient(getTransport()));
export const getOrchestrationMemoryServiceClient = () =>
  memoise("OrchestrationMemoryService", () => new OrchestrationMemoryServiceClient(getTransport()));
export const getOrchestrationSequentialThinkingServiceClient = () =>
  memoise("OrchestrationSequentialThinkingService", () => new OrchestrationSequentialThinkingServiceClient(getTransport()));
export const getOrchestrationContextManagerServiceClient = () =>
  memoise("OrchestrationContextManagerService", () => new OrchestrationContextManagerServiceClient(getTransport()));
export const getOrchestrationRustProServiceClient = () =>
  memoise("OrchestrationRustProService", () => new OrchestrationRustProServiceClient(getTransport()));
export const getBackendArchitectServiceClient = () =>
  memoise("BackendArchitectService", () => new BackendArchitectServiceClient(getTransport()));
export const getWorkstackServiceClient = () =>
  memoise("WorkstackService", () => new WorkstackServiceClient(getTransport()));

// internal_agents.proto
// internal_agents.proto — lifecycle/execution + per-agent services
// (no BackendArchitect / Workstack here; those live in orchestration.proto).
export const getAgentLifecycleClient = () =>
  memoise("AgentLifecycle", () => new AgentLifecycleClient(getTransport()));
export const getAgentExecutionClient = () =>
  memoise("AgentExecution", () => new AgentExecutionClient(getTransport()));
export const getMemoryServiceClient = () =>
  memoise("MemoryService", () => new MemoryServiceClient(getTransport()));
export const getSequentialThinkingServiceClient = () =>
  memoise("SequentialThinkingService", () => new SequentialThinkingServiceClient(getTransport()));
export const getContextManagerServiceClient = () =>
  memoise("ContextManagerService", () => new ContextManagerServiceClient(getTransport()));
export const getRustProServiceClient = () =>
  memoise("RustProService", () => new RustProServiceClient(getTransport()));

// ── New: adapters.proto (op-grpc-adapters) ───────────────────────────────
import {
  MailServiceClient as AdaptersMailServiceClient,
  NetmakerServiceClient,
  MqServiceClient,
} from "./gen/adapters.client";
export const getAdaptersMailServiceClient = () =>
  memoise("AdaptersMailService", () => new AdaptersMailServiceClient(getTransport()));
export const getNetmakerServiceClient = () =>
  memoise("NetmakerService", () => new NetmakerServiceClient(getTransport()));
export const getMqServiceClient = () =>
  memoise("MqService", () => new MqServiceClient(getTransport()));

// ── New: cognitive.proto (op-cognitive-mcp) ──────────────────────────────
import { CognitiveToolServiceClient } from "./gen/cognitive.client";
export const getCognitiveToolServiceClient = () =>
  memoise("CognitiveToolService", () => new CognitiveToolServiceClient(getTransport()));

// ── New: assistant/*.proto (op-assistant-grpc) ───────────────────────────
import { AgentServiceClient as AssistantAgentServiceClient } from "./gen/assistant/agent.client";
import { CronServiceClient } from "./gen/assistant/cron.client";
import { MemoryServiceClient as AssistantMemoryServiceClient } from "./gen/assistant/memory.client";
import { ModelServiceClient } from "./gen/assistant/model.client";
import { NamespaceMemoryServiceClient } from "./gen/assistant/namespace.client";
import { SessionServiceClient } from "./gen/assistant/session.client";
import { SoulServiceClient } from "./gen/assistant/soul.client";
import { TaskServiceClient } from "./gen/assistant/task.client";

export const getAssistantAgentServiceClient = () =>
  memoise("AssistantAgentService", () => new AssistantAgentServiceClient(getTransport()));
export const getCronServiceClient = () =>
  memoise("CronService", () => new CronServiceClient(getTransport()));
export const getAssistantMemoryServiceClient = () =>
  memoise("AssistantMemoryService", () => new AssistantMemoryServiceClient(getTransport()));
export const getModelServiceClient = () =>
  memoise("ModelService", () => new ModelServiceClient(getTransport()));
export const getNamespaceMemoryServiceClient = () =>
  memoise("NamespaceMemoryService", () => new NamespaceMemoryServiceClient(getTransport()));
export const getSessionServiceClient = () =>
  memoise("SessionService", () => new SessionServiceClient(getTransport()));
export const getSoulServiceClient = () =>
  memoise("SoulService", () => new SoulServiceClient(getTransport()));
export const getTaskServiceClient = () =>
  memoise("TaskService", () => new TaskServiceClient(getTransport()));

// ── New: ovsdaemon/v1/*.proto (op-openvswitch-daemon) ────────────────────
import { OvsdbServiceClient } from "./gen/ovsdaemon/v1/ovsdaemon.client";
import { OvsdbStreamServiceClient } from "./gen/ovsdaemon/v1/streaming.client";
export const getOvsdbServiceClient = () =>
  memoise("OvsdbService", () => new OvsdbServiceClient(getTransport()));
export const getOvsdbStreamServiceClient = () =>
  memoise("OvsdbStreamService", () => new OvsdbStreamServiceClient(getTransport()));

