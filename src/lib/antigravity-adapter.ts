/**
 * Antigravity SDK adapter.
 *
 * Maps our gRPC streaming frames (StateSync, EventChain, PluginService,
 * RegistryService, AccountabilityService, EmbeddingService, MCP) onto the
 * Google Antigravity SDK Interaction / Step / SSE event shape so the same
 * JSON-schema renderer can drive every panel (LiveLogPanel, GrpcExplorer,
 * Chat, etc.) end-to-end.
 *
 * References:
 *  - https://ai.google.dev/gemini-api/docs/interactions/streaming
 *  - https://ai.google.dev/gemini-api/docs/antigravity-agent
 *  - github.com/google-antigravity/antigravity-sdk-python types.py
 */

import { Decision } from "@/grpc/gen/operation";
import type { ChainEvent, StateChange, Signal } from "@/grpc/gen/operation";
import { RegistryEventType } from "@/grpc/gen/registry";
import type { RegistryEvent } from "@/grpc/gen/registry";
import type { EpisodeEvent, ReasoningEpisode, McpEvent } from "@/grpc/view-types";
import type { Timestamp } from "@/grpc/gen/google/protobuf/timestamp";

// ─── Antigravity Step / Delta types ────────────────────────────────────────

export type AgStepSource = "SYSTEM" | "USER" | "MODEL" | "UNKNOWN";
export type AgStepTarget = "TARGET_USER" | "TARGET_ENVIRONMENT" | "TARGET_UNSPECIFIED";
export type AgStepStatus = "ACTIVE" | "DONE" | "WAITING_FOR_USER" | "ERROR" | "CANCELED";

/** Subset of Antigravity Interactions API `step.type` values we emit. */
export type AgStepType =
  | "model_output"
  | "thought"
  | "function_call"
  | "function_result"
  | "google_search_call"
  | "google_search_result"
  | "code_execution_call"
  | "code_execution_result"
  | "system_message"
  | "compaction"
  | "finish"
  | "error";

export interface AgStep {
  id: string;
  type: AgStepType;
  source: AgStepSource;
  target: AgStepTarget;
  status: AgStepStatus;
  /** Human-readable label, e.g. tool name or operation. */
  name?: string;
  /** Free-form text content (markdown). */
  content?: string;
  /** Inline reasoning / thinking content. */
  thinking?: string;
  /** Tool/function arguments (for `*_call`). */
  arguments?: Record<string, unknown>;
  /** Tool/function result (for `*_result`). */
  result?: unknown;
  /** Strongly-typed structured payload (FINISH, audit, etc.). */
  structured_output?: unknown;
  /** Error message when status === "ERROR". */
  error?: string;
  /** Provenance — original source frame (debug / inspector). */
  source_frame?: { kind: AgFrameKind; raw: unknown };
  /** Wallclock timestamp (ISO 8601). */
  timestamp?: string;
}

export type AgDelta =
  | { type: "text"; text: string }
  | { type: "thought_summary"; text: string }
  | { type: "thought_signature"; signature: string }
  | { type: "image"; data: string; mime_type: string }
  | { type: "audio"; data: string; mime_type: string }
  | { type: "arguments_delta"; arguments: Record<string, unknown> }
  | { type: "content"; content: unknown };

export interface AgUsage {
  prompt_token_count?: number;
  candidates_token_count?: number;
  total_token_count?: number;
}

export type AgEvent =
  | {
      event_type: "interaction.created";
      interaction: { id: string; model: string; status: "in_progress" };
    }
  | {
      event_type: "interaction.status_update";
      interaction_id: string;
      status: "in_progress" | "completed" | "requires_action";
    }
  | { event_type: "step.start"; index: number; step: AgStep }
  | { event_type: "step.delta"; index: number; delta: AgDelta }
  | { event_type: "step.stop"; index: number }
  | {
      event_type: "interaction.completed";
      interaction: {
        id: string;
        status: "completed";
        usage?: AgUsage | null;
      };
    }
  | { event_type: "error"; error: { message: string; code: string } };

// ─── Frame kinds (source provenance) ───────────────────────────────────────

export type AgFrameKind =
  | "chain_event"
  | "state_change"
  | "plugin_signal"
  | "registry_event"
  | "episode_event"
  | "mcp_event"
  | "raw";

// ─── ID / index allocators ─────────────────────────────────────────────────

let _ix = 0;
/** Monotonic step index (per-process). Reset via `resetStepIndex()`. */
export function nextStepIndex(): number {
  return _ix++;
}
export function resetStepIndex(at = 0): void {
  _ix = at;
}

const nowIso = () => new Date().toISOString();

function timestampToIso(timestamp: Timestamp | undefined): string {
  if (!timestamp) return nowIso();
  return new Date(Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000)).toISOString();
}

function makeId(prefix: string, ...parts: Array<string | number>): string {
  return [prefix, ...parts].filter((p) => p !== "" && p !== undefined && p !== null).join(":");
}

// ─── Interaction lifecycle helpers ─────────────────────────────────────────

export function interactionCreated(id: string, model = "op-grpc"): AgEvent {
  return {
    event_type: "interaction.created",
    interaction: { id, model, status: "in_progress" },
  };
}

export function interactionStatus(
  id: string,
  status: "in_progress" | "completed" | "requires_action",
): AgEvent {
  return { event_type: "interaction.status_update", interaction_id: id, status };
}

export function interactionCompleted(id: string, usage?: AgUsage | null): AgEvent {
  return {
    event_type: "interaction.completed",
    interaction: { id, status: "completed", usage: usage ?? null },
  };
}

export function streamError(message: string, code = "stream_error"): AgEvent {
  return { event_type: "error", error: { message, code } };
}

/** Emit a complete atomic step (start + stop) for an instantaneous event. */
export function atomicStep(step: AgStep): AgEvent[] {
  const index = nextStepIndex();
  return [
    { event_type: "step.start", index, step },
    { event_type: "step.stop", index },
  ];
}

// ─── 1. EventChainService.SubscribeEvents → audit step ─────────────────────

export function chainEventToAg(event: ChainEvent): AgEvent[] {
  const denied = event.decision === Decision.DENY;
  const step: AgStep = {
    id: makeId("chain", event.eventId),
    type: denied ? "function_result" : "model_output",
    source: "SYSTEM",
    target: "TARGET_USER",
    status: denied ? "ERROR" : "DONE",
    name: event.operationType || "audit.event",
    content: event.denyReason
      ? denyReasonToText(event.denyReason)
      : `${event.operationType} ${event.target}`,
    arguments: {
      pluginId: event.pluginId,
      actorId: event.actorId,
      capabilityId: event.capabilityId,
      target: event.target,
      tags: event.tagsTouched,
      schemaVersion: event.schemaVersion,
    },
    structured_output: {
      eventId: event.eventId,
      eventHash: event.eventHash,
      prevHash: event.prevHash,
      inputPatchHash: event.inputPatchHash,
      resultEffectiveHash: event.resultEffectiveHash,
      decision: event.decision,
    },
    error: denied ? denyReasonToText(event.denyReason) : undefined,
    source_frame: { kind: "chain_event", raw: event },
    timestamp: timestampToIso(event.timestamp),
  };
  return atomicStep(step);
}

function denyReasonToText(reason: ChainEvent["denyReason"] | undefined): string {
  if (!reason) return "Denied";
  switch (reason.reason.oneofKind) {
    case "tagLock":
      return `tag locked: ${reason.reason.tagLock.tag} (${reason.reason.tagLock.wrapperId})`;
    case "constraintFail":
      return `constraint ${reason.reason.constraintFail.constraint}: ${reason.reason.constraintFail.message}`;
    case "capabilityMissing":
      return `missing capability: ${reason.reason.capabilityMissing.capability}`;
    case "readOnlyViolation":
      return `read-only field: ${reason.reason.readOnlyViolation.field}`;
  }
  return "Denied";
}

// ─── 2. PluginService.SubscribeSignals → function_call step ────────────────

export function signalFrameToAg(signal: Signal): AgEvent[] {
  const step: AgStep = {
    id: makeId("sig", signal.pluginId, signal.signalName),
    type: "function_call",
    source: "MODEL",
    target: "TARGET_ENVIRONMENT",
    status: "DONE",
    name: `${signal.pluginId}.${signal.signalName}`,
    arguments: {
      pluginId: signal.pluginId,
      objectPath: signal.objectPath,
      interfaceName: signal.interfaceName,
      signalName: signal.signalName,
      arguments: signal.arguments,
    },
    source_frame: { kind: "plugin_signal", raw: signal },
    timestamp: timestampToIso(signal.timestamp),
  };
  return atomicStep(step);
}

// ─── 3. StateSync.Subscribe (patches) → compaction + arguments_delta ───────

/**
 * State-change tracker that opens one logical step per plugin and emits
 * `arguments_delta` deltas for every subsequent change to that plugin.
 * Call `closePluginStep(pluginId)` to terminate the run when needed.
 */
export class StateChangeStream {
  private openIndex = new Map<string, number>();

  /** Emit events for a single StateChange frame. */
  ingest(change: StateChange): AgEvent[] {
    const events: AgEvent[] = [];
    let index = this.openIndex.get(change.pluginId);

    if (index === undefined) {
      index = nextStepIndex();
      this.openIndex.set(change.pluginId, index);
      const step: AgStep = {
        id: makeId("state", change.pluginId),
        type: "compaction",
        source: "SYSTEM",
        target: "TARGET_USER",
        status: "ACTIVE",
        name: `state.${change.pluginId}`,
        arguments: { pluginId: change.pluginId },
        source_frame: { kind: "state_change", raw: change },
        timestamp: timestampToIso(change.timestamp),
      };
      events.push({ event_type: "step.start", index, step });
    }

    events.push({
      event_type: "step.delta",
      index,
      delta: {
        type: "arguments_delta",
        arguments: {
          changeId: change.changeId,
          eventId: change.eventId,
          objectPath: change.objectPath,
          changeType: change.changeType,
          memberName: change.memberName,
          oldValue: change.oldValue,
          newValue: change.newValue,
          tagsTouched: change.tagsTouched,
          eventHash: change.eventHash,
          actorId: change.actorId,
          timestamp: timestampToIso(change.timestamp),
        },
      },
    });

    return events;
  }

  closePluginStep(pluginId: string): AgEvent[] {
    const index = this.openIndex.get(pluginId);
    if (index === undefined) return [];
    this.openIndex.delete(pluginId);
    return [{ event_type: "step.stop", index }];
  }

  closeAll(): AgEvent[] {
    const events: AgEvent[] = [];
    for (const index of this.openIndex.values()) {
      events.push({ event_type: "step.stop", index });
    }
    this.openIndex.clear();
    return events;
  }
}

// ─── 4. RegistryService.Watch → system_message step ────────────────────────

export function registryEventToAg(event: RegistryEvent): AgEvent[] {
  const component = event.component;
  if (!component) return [];
  const typeName = RegistryEventType[event.eventType] ?? "UNKNOWN";
  const status: AgStepStatus = event.eventType === RegistryEventType.REGISTRY_EVENT_STALE ? "ERROR" : "DONE";
  const step: AgStep = {
    id: makeId("registry", component.componentId, event.eventType),
    type: "system_message",
    source: "SYSTEM",
    target: "TARGET_USER",
    status,
    name: `registry.${typeName.toLowerCase()}`,
    content: `${typeName} ${component.name || component.componentId}`,
    arguments: {
      componentId: component.componentId,
      componentType: component.componentType,
      version: component.version,
      endpoint: component.endpoint,
    },
    structured_output: component,
    source_frame: { kind: "registry_event", raw: event },
    timestamp: timestampToIso(event.timestamp),
  };
  return atomicStep(step);
}

// ─── 5. AccountabilityService.SubscribeEpisodes → finish / thought ─────────

export function episodeEventToAg(event: EpisodeEvent): AgEvent[] {
  const ep = event.episode;
  let type: AgStepType = "thought";
  let status: AgStepStatus = "ACTIVE";

  switch (event.eventType) {
    case "opened":
      type = "thought";
      status = "ACTIVE";
      break;
    case "closed":
      type = "finish";
      status = "DONE";
      break;
    case "vectorized":
      type = "system_message";
      status = "DONE";
      break;
    case "pii_redacted":
      type = "system_message";
      status = "DONE";
      break;
  }

  const step: AgStep = {
    id: makeId("episode", ep.episodeId, event.eventType),
    type,
    source: "MODEL",
    target: "TARGET_USER",
    status,
    name: `episode.${event.eventType}`,
    content: ep.reasoningSummary || ep.goalText,
    thinking: ep.reasoningSummary,
    structured_output: episodeToStructured(ep, event.vectorized, event.queuePosition),
    source_frame: { kind: "episode_event", raw: event },
    timestamp: ep.endedAt || ep.startedAt || nowIso(),
  };
  return atomicStep(step);
}

function episodeToStructured(
  ep: ReasoningEpisode,
  vectorized: boolean,
  queuePosition?: number,
): Record<string, unknown> {
  return {
    episodeId: ep.episodeId,
    conversationId: ep.conversationId,
    pluginId: ep.pluginId,
    goalText: ep.goalText,
    trigger: ep.trigger,
    toolsConsulted: ep.toolsConsulted,
    decisionOutput: ep.decisionOutput,
    outcomeClass: ep.outcomeClass,
    confidence: ep.confidence,
    exitReason: ep.exitReason,
    piiFlagged: ep.piiFlagged,
    durationMs: ep.durationMs,
    similarity: ep.similarity,
    vectorized,
    queuePosition,
  };
}

// ─── 6. MCP events → function_call / function_result ───────────────────────

export function mcpEventToAg(event: McpEvent): AgEvent[] {
  const isResult = /response|result|done|completed/i.test(event.eventType);
  const payload = parseJsonSafe(event.dataJson);
  const step: AgStep = {
    id: makeId("mcp", event.eventType, event.sequence),
    type: isResult ? "function_result" : "function_call",
    source: isResult ? "SYSTEM" : "MODEL",
    target: isResult ? "TARGET_USER" : "TARGET_ENVIRONMENT",
    status: "DONE",
    name: `mcp.${event.eventType}`,
    arguments: isResult ? undefined : (payload as Record<string, unknown> | undefined),
    result: isResult ? payload : undefined,
    structured_output: { sequence: event.sequence, eventType: event.eventType },
    source_frame: { kind: "mcp_event", raw: event },
    timestamp: event.timestamp ? new Date(event.timestamp).toISOString() : nowIso(),
  };
  return atomicStep(step);
}

function parseJsonSafe(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ─── 7. Generic / unknown frame fallback ───────────────────────────────────

/** Wrap any unknown JSON frame as a model_output step so renderers stay uniform. */
export function rawFrameToAg(frame: unknown, label = "frame"): AgEvent[] {
  const step: AgStep = {
    id: makeId("raw", label, Date.now().toString(36)),
    type: "model_output",
    source: "SYSTEM",
    target: "TARGET_USER",
    status: "DONE",
    name: label,
    content: typeof frame === "string" ? frame : safeStringify(frame),
    structured_output: frame,
    source_frame: { kind: "raw", raw: frame },
    timestamp: nowIso(),
  };
  return atomicStep(step);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ─── 8. Multiplexed dispatch ───────────────────────────────────────────────

export type GrpcStreamFrame =
  | { kind: "chain_event"; data: ChainEvent }
  | { kind: "state_change"; data: StateChange }
  | { kind: "plugin_signal"; data: Signal }
  | { kind: "registry_event"; data: RegistryEvent }
  | { kind: "episode_event"; data: EpisodeEvent }
  | { kind: "mcp_event"; data: McpEvent }
  | { kind: "raw"; data: unknown; label?: string };

/**
 * Stateful multiplexer that routes any known gRPC frame to its
 * Antigravity SSE event sequence. Holds open StateSync compaction steps
 * across frames; call `close()` to flush remaining `step.stop` events.
 */
export class AntigravityStreamAdapter {
  private state = new StateChangeStream();

  constructor(public readonly interactionId: string = `op-${Date.now().toString(36)}`) {}

  open(model = "op-grpc"): AgEvent {
    return interactionCreated(this.interactionId, model);
  }

  ingest(frame: GrpcStreamFrame): AgEvent[] {
    switch (frame.kind) {
      case "chain_event":
        return chainEventToAg(frame.data);
      case "state_change":
        return this.state.ingest(frame.data);
      case "plugin_signal":
        return signalFrameToAg(frame.data);
      case "registry_event":
        return registryEventToAg(frame.data);
      case "episode_event":
        return episodeEventToAg(frame.data);
      case "mcp_event":
        return mcpEventToAg(frame.data);
      case "raw":
        return rawFrameToAg(frame.data, frame.label);
    }
  }

  error(message: string, code = "stream_error"): AgEvent {
    return streamError(message, code);
  }

  close(usage?: AgUsage | null): AgEvent[] {
    return [...this.state.closeAll(), interactionCompleted(this.interactionId, usage)];
  }
}
