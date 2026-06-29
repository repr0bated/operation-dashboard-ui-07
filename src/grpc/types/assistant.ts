/**
 * Assistant gRPC Gateway types (assistant.v1)
 *
 * Matches proto definitions in crates/op-assistant-grpc/proto/assistant/
 */

// ── Common ──────────────────────────────────────────────────────────────────

export interface Empty {}

export interface Pagination {
  limit: number;
  offset: number;
}

// ── Agent ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  tags: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ListAgentsRequest {
  pagination?: Pagination;
}

export interface ListAgentsResponse {
  agents: Agent[];
  total: number;
}

export interface GetAgentRequest {
  id: string;
}

export interface CreateAgentRequest {
  agent: Agent;
}

export interface UpdateAgentRequest {
  id: string;
  agent: Partial<Agent>;
}

export interface StartRunRequest {
  agentId: string;
  prompt: string;
  modelOverride?: string;
}

export interface Run {
  id: string;
  agentId: string;
  status: string;
  model: string;
  createdAt?: Timestamp;
}

export interface RunEvent {
  type: string;
  data: string;
  timestamp?: Timestamp;
}

export interface StreamRunEventsRequest {
  runId: string;
}

// ── Session ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  agentId: string;
  model: string;
  status: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ListSessionsRequest {
  agentId?: string;
  pagination?: Pagination;
}

export interface ListSessionsResponse {
  sessions: Session[];
  total: number;
}

export interface CreateSessionRequest {
  agentId: string;
  model?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  role?: string;
}

export interface SessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp?: Timestamp;
}

// ── Task ────────────────────────────────────────────────────────────────────
export interface GetSessionHistoryRequest {
  sessionId: string;
  pagination?: Pagination;
}

export interface SessionHistory {
  sessionId: string;
  messages: SessionMessage[];
}


export interface TaskDef {
  name: string;
  description: string;
  parameters: string;
}

export interface ListToolsResponse {
  tools: TaskDef[];
}

export interface ExecuteTaskRequest {
  tool: string;
  parameters: string;
  agentId?: string;
}

export interface TaskResult {
  output: string;
  error: string;
}

// ── Model ───────────────────────────────────────────────────────────────────

export interface Model {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
}

export interface ListModelsResponse {
  models: Model[];
}

export interface SwitchModelRequest {
  agentId: string;
  modelId: string;
}

// ── Cron ────────────────────────────────────────────────────────────────────

export interface CronJob {
  id: string;
  agentId: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  lastRun?: Timestamp;
}

export interface ListCronJobsResponse {
  jobs: CronJob[];
}

export interface CreateCronJobRequest {
  agentId: string;
  schedule: string;
  prompt: string;
}

// ── Soul ────────────────────────────────────────────────────────────────────

export interface SoulMemory {
  agentId: string;
  identity: string;
  personality: string;
  traits: Record<string, unknown>;
  version: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GetSoulMemoryRequest {
  agentId: string;
}

export interface UpdateSoulMemoryRequest {
  agentId: string;
  identity?: string;
  personality?: string;
  traits?: Record<string, unknown>;
}

export interface ListSoulMemoriesRequest {
  pagination?: Pagination;
}

export interface ListSoulMemoriesResponse {
  memories: SoulMemory[];
  total: number;
}

// ── Namespace ───────────────────────────────────────────────────────────────

export interface MemoryNamespace {
  agentId: string;
  namespace: string;
  entryCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SetMemoryNamespaceRequest {
  agentId: string;
  namespace: string;
}

export interface ListMemoryNamespacesResponse {
  namespaces: MemoryNamespace[];
  total: number;
}

// ── Memory ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  namespace: string;
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ReadMemoryRequest {
  namespace: string;
  keys: string[];
  pagination?: Pagination;
}

export interface ReadMemoryResponse {
  entries: MemoryEntry[];
}

export interface WriteMemoryRequest {
  namespace: string;
  entries: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">[];
}

export interface WriteMemoryResponse {
  written: number;
}

export interface DeleteMemoryRequest {
  namespace: string;
  keys: string[];
}

export interface DeleteMemoryResponse {
  deleted: number;
}

export interface SearchMemoryRequest {
  query: string;
  namespaces: string[];
  limit: number;
}

export interface SearchMemoryResponse {
  entries: MemoryEntry[];
}

export interface MemoryStats {
  namespace: string;
  entryCount: number;
  bytesUsed: number;
  lastUpdated?: Timestamp;
}

// ── Shared ──────────────────────────────────────────────────────────────────

export interface Timestamp {
  seconds: number;
  nanos: number;
}
