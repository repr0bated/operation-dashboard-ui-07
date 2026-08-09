// ── Bridge services ──────────────────────────────────────────────────────────
export {
  stateSync,
  pluginService,
  eventChainService,
  componentRegistry,
  // Domain services
  mailService,
  privacyService,
  registrationService,
  mcpService,
  accountabilityService,
  chatService,
  // Architecture services (§2,5,6,8,9)
  blockchainService,
  btrfsService,
  personaService,
  dataStoreService,
  embeddingService,
  antigravityService,
  // Legacy assistant.v1 stubs (throw — use chatbotCognitive)
  soulService,
  namespaceMemoryService,
  // Transport
  getTransport,
  resetTransport,
} from "./client";

export { chatbotCognitive } from "./chatbot-cognitive";
export type { ChatbotSoul, ChatbotNamespace } from "./chatbot-cognitive";

// ── Plugin methods facade (auto-generated registry over plugin_methods/*) ───
export {
  pluginMethods,
  PLUGIN_METHOD_ENTRIES,
  PLUGIN_METHOD_BY_SUBID,
  PLUGIN_METHOD_BY_PLUGIN,
  type PluginMethodEntry,
} from "./plugin-methods";

export { hostRuntime } from "./host-runtime";

// ── Generated protobuf types ────────────────────────────────────────────────
export * from "./gen/operation";
export * from "./gen/registry";
export * from "./gen/mail";
export * from "./gen/privacy_network";
export * from "./gen/registration";
export * from "./gen/blockchain";
export * from "./gen/btrfs";
export * from "./gen/datastore";
export * from "./gen/persona";
export * from "./gen/assistant/common";
export * from "./gen/assistant/agent";
export * from "./gen/assistant/cron";
export * from "./gen/assistant/memory";
export * from "./gen/assistant/model";
export * from "./gen/assistant/namespace";
export * from "./gen/assistant/session";
export * from "./gen/assistant/soul";


// ── Protobuf helpers ────────────────────────────────────────────────────────
export {
  structToObject,
  valueToJs,
  objectToStruct,
} from "./google/protobuf/struct";
