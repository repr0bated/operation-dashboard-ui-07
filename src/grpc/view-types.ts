import type { ProtobufStruct, ProtobufValue } from "./google/protobuf/struct";

export enum ServiceType {
  SIMPLE = 0,
  FORKING = 1,
  ONESHOT = 2,
  NOTIFY = 3,
}

export enum RestartCondition {
  NEVER = 0,
  ALWAYS = 1,
  ON_FAILURE = 2,
}

export enum ServiceState {
  STOPPED = 0,
  STARTING = 1,
  RUNNING = 2,
  STOPPING = 3,
  FAILED = 4,
}

export interface ExecConfig {
  startProgram: string;
  startArgs: string[];
  stopProgram?: string;
  stopArgs: string[];
  workingDir?: string;
  user?: string;
  group?: string;
}

export interface RestartPolicy {
  condition: RestartCondition;
  delay: string;
  maxRetries?: number;
}

export interface ResourceLimits {
  memoryMax?: number;
  cpuQuota?: number;
  tasksMax?: number;
}

export interface HealthCheck {
  program: string;
  args: string[];
  interval: string;
  timeout: string;
  retries: number;
}

export interface ServiceDef {
  name: string;
  type: ServiceType;
  exec: ExecConfig;
  dependsOn: string[];
  restart: RestartPolicy;
  environment: Record<string, string>;
  resources?: ResourceLimits;
  healthCheck?: HealthCheck;
  enabled: boolean;
}

export interface ServiceStatus {
  name: string;
  state: ServiceState;
  pid?: number;
  error?: string;
  startedAt?: string;
}

export interface ServiceEvent {
  name: string;
  oldState: ServiceState;
  newState: ServiceState;
  timestamp: string;
}

export interface GetServiceResponse {
  service: ServiceDef;
  status: ServiceStatus;
}

export interface ListServicesResponse {
  services: ServiceDef[];
}

export interface WatchServicesRequest {
  names: string[];
}

export enum ServerMode {
  UNKNOWN = 0,
  COMPACT = 1,
  AGENTS = 2,
  FULL = 3,
}

export enum ParameterType {
  STRING = 0,
  INTEGER = 1,
  NUMBER = 2,
  BOOLEAN = 3,
  ARRAY = 4,
  OBJECT = 5,
}

export interface McpRequest {
  jsonrpc: string;
  id?: string;
  method: string;
  params?: ProtobufStruct;
}

export interface McpResponse {
  jsonrpc: string;
  id?: string;
  result?: ProtobufStruct;
  error?: McpError;
}

export interface McpError {
  code: number;
  message: string;
  data?: ProtobufStruct;
}

export interface SubscribeRequest {
  eventTypes: string[];
  sessionId?: string;
}

export interface McpEvent {
  eventType: string;
  dataJson: string;
  timestamp: number;
  sequence: number;
}

export interface HealthResponse {
  healthy: boolean;
  version: string;
  serverName: string;
  mode: ServerMode;
  connectedAgents: string[];
  uptimeSecs: number;
}

export interface InitializeRequest {
  clientName: string;
  clientVersion?: string;
  sessionId?: string;
  capabilities: string[];
}

export interface InitializeResponse {
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
  capabilities: string[];
  startedAgents: string[];
  sessionId: string;
}

export interface ListToolsRequest {
  category?: string;
  query?: string;
  limit: number;
  offset: number;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: ToolSchema;
  category?: string;
  tags: string[];
}

export interface ToolSchema {
  parameters: ToolParameter[];
  required: string[];
}

export interface ToolParameter {
  name: string;
  type: ParameterType;
  description: string;
  defaultValue?: ProtobufValue;
  enumValues: string[];
}

export interface ListToolsResponse {
  tools: ToolInfo[];
  total: number;
  hasMore: boolean;
}

export enum FileOperation {
  READ = 0,
  WRITE = 1,
  DELETE = 2,
  LIST = 3,
}

export interface FileMode {
  mode: number;
}

export interface FileSystemArgs {
  path: string;
  content?: string;
  operation: FileOperation;
  mode?: FileMode;
}

export interface NetworkArgs {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface DatabaseArgs {
  query: string;
  parameters: Record<string, string>;
}

export interface ShellArgs {
  command: string;
  args: string[];
  env: Record<string, string>;
  workingDir?: string;
}

export interface ToolArguments {
  filesystem?: FileSystemArgs;
  network?: NetworkArgs;
  database?: DatabaseArgs;
  shell?: ShellArgs;
  generic?: ProtobufStruct;
}

export interface CallToolRequest {
  toolName: string;
  arguments: ToolArguments;
  sessionId?: string;
  timeoutMs?: number;
}

export interface CallToolResponse {
  success: boolean;
  result: ProtobufStruct;
  error?: string;
  durationMs: number;
}

export interface ToolOutput {
  outputType: number;
  content: string;
  sequence: number;
  isFinal: boolean;
  exitCode?: number;
}

export interface SearchEpisodesRequest {
  query: string;
  outcomeClass?: string;
  pluginId?: string;
  conversationId?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  limit?: number;
}

export interface ReasoningEpisode {
  episodeId: string;
  goalText: string;
  trigger: string;
  toolsConsulted: string[];
  reasoningSummary: string;
  decisionOutput: string;
  outcomeClass: string;
  confidence: number;
  pluginId: string;
  conversationId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  exitReason: string;
  piiFlagged: boolean;
  similarity: number;
}

export interface SearchEpisodesResponse {
  episodes: ReasoningEpisode[];
  totalFound: number;
  queryVector?: number[];
}

export interface GetEpisodeRequest {
  episodeId: string;
}

export interface GetEpisodeResponse {
  episode: ReasoningEpisode;
  relatedEpisodes: ReasoningEpisode[];
}

export interface CollectionStatsResponse {
  collectionName: string;
  pointCount: number;
  vectorDimension: number;
  segmentCount: number;
  diskSizeBytes: number;
  ramSizeBytes: number;
  lastUpdated: string;
}

export interface ChatContextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatWithContextRequest {
  message: string;
  episodeIds: string[];
  conversationHistory: ChatContextMessage[];
}

export interface ChatWithContextResponse {
  reply: string;
  referencedEpisodes: string[];
  model: string;
}

export interface SubscribeEpisodesRequest {
  pluginId?: string;
  outcomeClassFilter?: string;
  includeExisting?: boolean;
}

export interface EpisodeEvent {
  eventType: "opened" | "closed" | "vectorized" | "pii_redacted";
  episode: ReasoningEpisode;
  vectorized: boolean;
  queuePosition?: number;
}

export interface GetPiiPolicyResponse {
  redactionEnabled: boolean;
  fieldsRedacted: string[];
  piiFlaggedCount: number;
  lastFlaggedAt?: string;
}

export interface PluginFootprint {
  blockHash: string;
  pluginId: string;
  operation: string;
  actor: string;
  outcome: string;
  summary: string;
  sessionId: string;
  timestamp: string;
  previousHash: string;
  blockIndex: number;
}

export interface GetFootprintsRequest {
  fromIndex?: number;
  toIndex?: number;
  limit?: number;
  pluginId?: string;
}

export interface GetFootprintsResponse {
  footprints: PluginFootprint[];
  totalBlocks: number;
  chainValid: boolean;
}

export interface VerifyBlockchainRequest {
  fromIndex?: number;
  toIndex?: number;
}

export interface VerifyBlockchainResponse {
  valid: boolean;
  checkedBlocks: number;
  firstInvalidIndex?: number;
  errors: string[];
}

export interface GetEmbeddingQueueStatusResponse {
  channelCapacity: number;
  channelUsed: number;
  droppedCount: number;
  workerActive: boolean;
  retryPending: number;
  lastEmbeddedAt: string;
  lastErrorAt?: string;
  lastError?: string;
}

export interface QdrantCollectionRole {
  name: string;
  role: "ai_analysis" | "disaster_recovery" | "offsite_backup";
  pointCount: number;
  diskSizeBytes: number;
  lastUpdated: string;
}

export interface GetQdrantRolesResponse {
  roles: QdrantCollectionRole[];
  qdrantEndpoint: string;
  qdrantProtocol: string;
}

export interface GetSubvolumesResponse {
  subvolumes: BtrfsSubvolumeView[];
  raidLevel?: string;
  devices?: string[];
  totalBytes?: number;
  usedBytes?: number;
}

export interface GetSnapshotsRequest {
  subvolume?: string;
  limit?: number;
}

export interface GetSnapshotsResponse {
  snapshots: BtrfsSnapshotView[];
  totalCount?: number;
}

export interface BtrfsSubvolumeView {
  name: string;
  path: string;
  purpose: "audit_ledger" | "dr_state" | "vector_storage";
  sizeBytes: number;
  usedBytes: number;
  snapshotCount: number;
  lastModified: string;
}

export interface BtrfsSnapshotView {
  id: string;
  subvolume: string;
  createdAt: string;
  sizeBytes: number;
  parentSnapshotId?: string;
  pinned: boolean;
  pinnedRemotes: string[];
}

export interface SendState {
  remoteName: string;
  remoteHost: string;
  remotePath: string;
  lastSentSnapshotId: string;
  lastSentAt: string;
  status: "idle" | "sending" | "error";
  lastError?: string;
  bytesTransferred: number;
}

export interface GetSendStateResponse {
  remotes: SendState[];
}

export interface GetDrStatusResponse {
  status: DrRecoveryStatusView;
  recoveryOrder?: string[];
}

export interface DrRecoveryStatusView {
  lastCheckpoint: string;
  stateSubvolCurrent: boolean;
  vectorSnapshotAvailable: boolean;
  blocksToReplay: number;
  recoverySteps: string[];
}

export interface CreatePersonaRequest {
  persona: import("./gen/persona").Persona;
}

export interface CreatePersonaResponse {
  persona: import("./gen/persona").Persona;
  created: boolean;
}

export interface UpdatePersonaRequest {
  name: string;
  persona: Partial<import("./gen/persona").Persona>;
}

export interface UpdatePersonaResponse {
  persona: import("./gen/persona").Persona;
  updated: boolean;
}

export interface DeletePersonaRequest {
  name: string;
}

export interface DeletePersonaResponse {
  deleted: boolean;
}

export interface AgentRoute {
  modelString: string;
  resolvedModel: string;
  provider: string;
  fallback?: string;
  activeRequests: number;
}

export interface ListAgentRoutesResponse {
  routes: AgentRoute[];
}

export interface DataStoreViewStatus {
  name: string;
  location: string;
  description: string;
  durability: string;
  status: "healthy" | "degraded" | "unreachable";
  sizeBytes?: number;
  usedBytes?: number;
  lastChecked: string;
  latencyMs?: number;
  details: Record<string, unknown>;
}

export interface GetDataStoresResponse {
  stores: DataStoreViewStatus[];
}

export interface GetStoreDetailRequest {
  storeName: string;
}

export interface GetStoreDetailResponse {
  sqlite?: unknown;
  qdrant?: unknown;
  btrfs?: unknown;
  embeddingChannel?: unknown;
}

export interface EmbedRequestInfo {
  blockHash: string;
  embeddingText: string;
  collection: string;
  payload: Record<string, unknown>;
  status: "queued" | "processing" | "completed" | "failed" | "dropped";
  attempt: number;
  queuedAt: string;
  processedAt?: string;
  error?: string;
}

export interface GetEmbeddingQueueRequest {
  limit?: number;
  statusFilter?: string;
}

export interface GetEmbeddingQueueResponse {
  requests: EmbedRequestInfo[];
  queueDepth: number;
  channelCapacity: number;
  channelUsed: number;
  totalProcessed: number;
  totalDropped: number;
  totalFailed: number;
}

export interface EmbeddingWorkerStatus {
  active: boolean;
  currentRequest?: string;
  provider: string;
  model: string;
  vectorDimension: number;
  retryConfig: {
    maxAttempts: number;
    baseDelayMs: number;
    backoffMultiplier: number;
  };
  stats: {
    embedsCompleted: number;
    embedsFailed: number;
    avgLatencyMs: number;
    uptime: string;
  };
}

export interface GetEmbeddingWorkerStatusResponse {
  worker: EmbeddingWorkerStatus;
}

export interface PreviewEmbeddingTextRequest {
  blockHash: string;
}

export interface PreviewEmbeddingTextResponse {
  preview: unknown;
}

export interface ChannelDiagnostics {
  capacity: number;
  currentUsage: number;
  dropPolicy: string;
  rationale: string;
  auditSourceOfTruth: string;
  totalDropped: number;
  dropRate: number;
}

export interface GetChannelDiagnosticsResponse {
  channel: ChannelDiagnostics;
}