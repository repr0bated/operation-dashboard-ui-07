// ── Bridge services ──────────────────────────────────────────────────────────
export {
  stateSync,
  pluginService,
  eventChainService,
  ovsdbMirror,
  runtimeMirror,
  componentRegistry,
  // Domain services
  mailService,
  privacyService,
  registrationService,
  serviceManager,
  mcpService,
  accountabilityService,
  // Architecture services (§2,5,6,8,9)
  blockchainService,
  btrfsService,
  personaService,
  dataStoreService,
  embeddingService,
  // D-Bus passthrough
  dbusPassthrough,
  // Assistant services (via D-Bus passthrough)
  assistantService,
  // Transport
  getTransport,
  resetTransport,
} from "./client";

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

// ── Compatibility view/RPC shapes not present in current proto set ──────────
export * from "./view-types";

// ── Protobuf helpers ────────────────────────────────────────────────────────
export {
  structToObject,
  valueToJs,
  objectToStruct,
} from "./google/protobuf/struct";
