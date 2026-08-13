/**
 * Zeroclaw model routing (OD-28) — schemars → JSON Schema → populated UI.
 *
 * The control plane emits routing as a schemars JSON Schema (GetConfigSchema)
 * and as a sealed PluginSchema blob. This module:
 *   1. Recognises `selected_provider` / `selected_model` / `model_routes`
 *   2. Resolves schemars `$ref` / `$defs` / `type: ["string","null"]`
 *   3. Overlays live GetState / GetRouter / GetModelRoutes / ListProviders
 *      / GetModelAssignments
 *   4. Produces a SchemaRenderer-ready schema + Chat SendRequest payload
 *
 * Embedding Pipeline is the UI for the `vectorization` model assignment
 * (`GetModelAssignments` / `SetVectorizationModel`), not chat `selected_model`.
 */
import { valueToJs } from "@/grpc/google/protobuf/struct";
import type { JsonSchema } from "@/types/api";

export const ROUTING_FIELDS = [
  "selected_provider",
  "selected_model",
  "model_routes",
] as const;

export type RoutingField = (typeof ROUTING_FIELDS)[number];

export const ZEROCLAW_SUBIDS = {
  configSchema: "obs.service.zeroclaw.config-schema.get@v1",
  state: "obs.service.zeroclaw.state.get@v1",
  modelRoutes: "obs.service.zeroclaw.model-routes.list@v1",
  providers: "obs.service.zeroclaw.providers.list@v1",
  router: "obs.service.zeroclaw.router.get@v1",
  modelAssignments: "obs.service.zeroclaw.model-assignments.get@v1",
  setProvider: "mut.service.zeroclaw.provider.set@v1",
  setModel: "mut.service.zeroclaw.model.set@v1",
  setVectorizationModel: "mut.service.zeroclaw.model-assignments.vectorization.set@v1",
  setQdrantRetrievalModel: "mut.service.zeroclaw.model-assignments.qdrant-retrieval.set@v1",
  setCozoRetrievalModel: "mut.service.zeroclaw.model-assignments.cozo-retrieval.set@v1",
  setOvsRoutingModel: "mut.service.zeroclaw.model-assignments.ovs-routing.set@v1",
  setObfuscationModel: "mut.service.zeroclaw.model-assignments.obfuscation.set@v1",
} as const;

/** Embedding models are not chat LLM routes. */
export const EMBEDDING_SUBIDS = {
  listModels: "obs.service.embedding.model.list@v1",
} as const;

export const ASSIGNMENT_ROLES = [
  "vectorization",
  "qdrant_retrieval",
  "cozo_retrieval",
  "ovs_routing",
  "obfuscation",
] as const;

export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export type ModelAssignments = Record<AssignmentRole, string | null>;

export const EMPTY_ASSIGNMENTS: ModelAssignments = {
  vectorization: null,
  qdrant_retrieval: null,
  cozo_retrieval: null,
  ovs_routing: null,
  obfuscation: null,
};

export type AssignmentCatalog = "embedding" | "routes";

export const ASSIGNMENT_META: Record<
  AssignmentRole,
  { label: string; catalog: AssignmentCatalog }
> = {
  vectorization: { label: "Vectorization", catalog: "embedding" },
  qdrant_retrieval: { label: "Qdrant retrieval", catalog: "routes" },
  cozo_retrieval: { label: "Cozo retrieval", catalog: "routes" },
  ovs_routing: { label: "OVS routing", catalog: "routes" },
  obfuscation: { label: "Obfuscation", catalog: "routes" },
};

export const ASSIGNMENT_SETTERS: Record<AssignmentRole, string> = {
  vectorization: ZEROCLAW_SUBIDS.setVectorizationModel,
  qdrant_retrieval: ZEROCLAW_SUBIDS.setQdrantRetrievalModel,
  cozo_retrieval: ZEROCLAW_SUBIDS.setCozoRetrievalModel,
  ovs_routing: ZEROCLAW_SUBIDS.setOvsRoutingModel,
  obfuscation: ZEROCLAW_SUBIDS.setObfuscationModel,
};

export type CallSubid = (subid: string, input?: object) => Promise<unknown>;

export interface RoutableModel {
  id: string;
  name?: string;
  description?: string | null;
  parameters?: string | null;
  available?: boolean;
  tags?: string[];
  provider?: string;
}

export interface ZeroclawRoutingState {
  selected_provider: string | null;
  selected_model: string | null;
  model_routes: RoutableModel[];
  providers: string[];
  assignments: ModelAssignments;
}

export interface ZeroclawRoutingSnapshot {
  schema: JsonSchema;
  populatedSchema: JsonSchema;
  state: ZeroclawRoutingState;
}

export const EMPTY_ROUTING_STATE: ZeroclawRoutingState = {
  selected_provider: null,
  selected_model: null,
  model_routes: [],
  providers: [],
  assignments: { ...EMPTY_ASSIGNMENTS },
};

type PluginField = {
  name?: string;
  field_type?: unknown;
  description?: string | null;
  required?: boolean;
  read_only?: boolean;
};

export interface PluginSchemaLike {
  name?: string;
  display_name?: string | null;
  description?: string;
  fields?: Record<string, PluginField> | PluginField[];
  methods?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  const js = valueToJs(v);
  return isRecord(js) ? js : null;
}

/** Walk a JSON value and collect every object key. */
function collectKeys(value: unknown, into: Set<string>, depth = 0): void {
  if (depth > 24 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    into.add(key);
    collectKeys(child, into, depth + 1);
  }
}

export function schemaPropagatesRouting(schema: unknown): boolean {
  const keys = new Set<string>();
  collectKeys(schema, keys);
  return ROUTING_FIELDS.every((field) => keys.has(field));
}

function lookupRef(ref: string, root: JsonSchema): JsonSchema | undefined {
  const defs = (root.$defs ?? root.definitions) as Record<string, JsonSchema> | undefined;
  if (!defs) return undefined;
  const prefixes = ["#/$defs/", "#/definitions/"];
  for (const prefix of prefixes) {
    if (ref.startsWith(prefix)) {
      const name = decodeURIComponent(ref.slice(prefix.length));
      const def = defs[name];
      if (def && typeof def === "object") return def;
    }
  }
  return undefined;
}

function normalizeType(schema: JsonSchema): JsonSchema {
  if (!Array.isArray(schema.type)) return schema;
  const nonNull = schema.type.filter((t) => t !== "null");
  if (nonNull.length === 1) return { ...schema, type: nonNull[0] };
  return schema;
}

/** Resolve schemars `$ref` / `$defs` and flatten `type: ["string","null"]`. */
export function resolveSchemarsRoot(schema: JsonSchema): JsonSchema {
  return deepResolve(schema, schema, new Set());
}

function deepResolve(schema: JsonSchema, root: JsonSchema, seen: Set<string>): JsonSchema {
  const ref = typeof schema.$ref === "string" ? schema.$ref : null;
  let current: JsonSchema = schema;
  if (ref) {
    if (seen.has(ref)) return { type: "object" };
    seen.add(ref);
    const resolved = lookupRef(ref, root);
    if (resolved) {
      const { $ref: _drop, ...rest } = current;
      current = { ...resolved, ...rest, $defs: root.$defs ?? resolved.$defs };
    }
  }
  current = normalizeType(current);
  const out: JsonSchema = { ...current };
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([key, prop]) => [key, deepResolve(prop, root, seen)]),
    );
  }
  if (out.items && typeof out.items === "object" && !Array.isArray(out.items)) {
    out.items = deepResolve(out.items, root, seen);
  }
  return out;
}

function fieldTypeToJsonSchema(fieldType: unknown): JsonSchema {
  if (!fieldType) return { type: "string" };
  if (typeof fieldType === "string") {
    if (fieldType === "integer") return { type: "integer" };
    if (fieldType === "float" || fieldType === "number") return { type: "number" };
    if (fieldType === "boolean") return { type: "boolean" };
    if (fieldType === "object") return { type: "object" };
    if (fieldType === "array") return { type: "array", items: { type: "string" } };
    return { type: "string" };
  }
  if (!isRecord(fieldType)) return { type: "string" };
  if (isRecord(fieldType.object)) {
    const properties: Record<string, JsonSchema> = {};
    for (const [key, field] of Object.entries(fieldType.object)) {
      properties[key] = pluginFieldToJsonSchema(field);
    }
    return { type: "object", properties };
  }
  if ("array" in fieldType) {
    return { type: "array", items: fieldTypeToJsonSchema(fieldType.array) };
  }
  return { type: "object" };
}

function pluginFieldToJsonSchema(field: unknown): JsonSchema {
  if (!isRecord(field)) return fieldTypeToJsonSchema(field);
  const schema = fieldTypeToJsonSchema(field.field_type);
  if (typeof field.description === "string" && field.description) {
    schema.description = field.description;
  }
  return schema;
}

function fieldsMap(fields: PluginSchemaLike["fields"]): Record<string, PluginField> {
  if (!fields) return {};
  if (Array.isArray(fields)) {
    const out: Record<string, PluginField> = {};
    fields.forEach((field, i) => {
      const name = isRecord(field) && typeof field.name === "string" ? field.name : String(i);
      out[name] = field;
    });
    return out;
  }
  return fields;
}

export function pluginSchemaHasRouting(schema: unknown): boolean {
  if (!isRecord(schema)) return false;
  const fields = fieldsMap(schema.fields as PluginSchemaLike["fields"]);
  return ROUTING_FIELDS.every((field) => field in fields);
}

export function jsonSchemaHasRouting(schema: JsonSchema): boolean {
  const root = resolveSchemarsRoot(schema);
  const properties = root.properties ?? {};
  return ROUTING_FIELDS.every((field) => field in properties);
}

export function pluginSchemaToJsonSchema(schema: unknown): JsonSchema {
  const record = isRecord(schema) ? schema : {};
  const fields = fieldsMap(record.fields as PluginSchemaLike["fields"]);
  const properties: Record<string, JsonSchema> = {};
  for (const [name, field] of Object.entries(fields)) {
    properties[name] = pluginFieldToJsonSchema(field);
  }
  const json: JsonSchema = {
    type: "object",
    title: typeof record.display_name === "string"
      ? record.display_name
      : typeof record.name === "string"
        ? record.name
        : "Zeroclaw",
    properties,
  };
  if (typeof record.description === "string") json.description = record.description;
  return json;
}

function looksLikePluginSchema(schema: unknown): schema is PluginSchemaLike {
  return isRecord(schema) && "fields" in schema && !("$ref" in schema) && !("properties" in schema);
}

export function routingJsonSchema(schema: unknown): JsonSchema {
  if (!schema || typeof schema !== "object") return { type: "object", properties: {} };
  if (looksLikePluginSchema(schema)) return pluginSchemaToJsonSchema(schema);
  return resolveSchemarsRoot(schema as JsonSchema);
}

export function populateRoutingSchema(
  schema: JsonSchema,
  state: ZeroclawRoutingState,
): JsonSchema {
  const root = routingJsonSchema(schema);
  const properties = { ...(root.properties ?? {}) };
  if (properties.selected_provider && state.providers.length > 0) {
    properties.selected_provider = {
      ...properties.selected_provider,
      type: "string",
      enum: state.providers,
    };
  }
  const modelIds = state.model_routes.map((m) => m.id).filter(Boolean);
  if (state.selected_model && !modelIds.includes(state.selected_model)) {
    modelIds.unshift(state.selected_model);
  }
  if (properties.selected_model && modelIds.length > 0) {
    properties.selected_model = {
      ...properties.selected_model,
      type: "string",
      enum: modelIds,
    };
  }
  return { ...root, type: "object", properties };
}

function asModel(value: unknown): RoutableModel | null {
  if (typeof value === "string" && value.trim()) return { id: value };
  const obj = asRecord(value);
  if (!obj) return null;
  const id = pickString(obj, "id", "model", "model_id", "modelId", "name");
  if (!id) return null;
  const tags = obj.tags;
  return {
    id,
    name: pickString(obj, "name") ?? undefined,
    description: pickString(obj, "description"),
    parameters: pickString(obj, "parameters", "params"),
    available: typeof obj.available === "boolean" ? obj.available : undefined,
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
    provider: pickString(obj, "provider", "provider_id", "providerId") ?? undefined,
  };
}

function asProviderId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  const obj = asRecord(value);
  if (!obj) return null;
  return pickString(obj, "id", "provider_id", "providerId", "name", "provider");
}

function unwrapList(value: unknown): unknown[] {
  const js = valueToJs(value);
  if (Array.isArray(js)) return js;
  const obj = asRecord(js);
  if (!obj) return [];
  for (const key of ["model_routes", "modelRoutes", "models", "providers", "items", "values"]) {
    const inner = obj[key];
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

function assignmentModel(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const obj = asRecord(value);
  if (!obj) return null;
  return pickString(obj, "model", "model_id", "modelId", "id", "name");
}

/** Parse GetModelAssignments / GetState.model_assignments into role → model id. */
export function assignmentsFromValue(raw: unknown): ModelAssignments {
  const obj = asRecord(raw) ?? {};
  const inner =
    asRecord(obj.model_assignments) ??
    asRecord(obj.modelAssignments) ??
    obj;
  return {
    vectorization: assignmentModel(inner.vectorization),
    qdrant_retrieval:
      assignmentModel(inner.qdrant_retrieval) ?? assignmentModel(inner.qdrantRetrieval),
    cozo_retrieval:
      assignmentModel(inner.cozo_retrieval) ?? assignmentModel(inner.cozoRetrieval),
    ovs_routing:
      assignmentModel(inner.ovs_routing) ?? assignmentModel(inner.ovsRouting),
    obfuscation: assignmentModel(inner.obfuscation),
  };
}

function overlayAssignments(base: ModelAssignments, overlay: unknown): ModelAssignments {
  if (overlay == null) return base;
  const next = assignmentsFromValue(overlay);
  return {
    vectorization: next.vectorization ?? base.vectorization,
    qdrant_retrieval: next.qdrant_retrieval ?? base.qdrant_retrieval,
    cozo_retrieval: next.cozo_retrieval ?? base.cozo_retrieval,
    ovs_routing: next.ovs_routing ?? base.ovs_routing,
    obfuscation: next.obfuscation ?? base.obfuscation,
  };
}

function uniqueStrings(values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.trim() && !out.includes(value)) out.push(value);
  }
  return out;
}

export function parseEmbeddingModels(raw: unknown): string[] {
  const js = valueToJs(raw);
  if (Array.isArray(js)) return uniqueStrings(js);
  const obj = asRecord(js);
  if (!obj) return [];
  for (const key of ["models", "embedding_models", "embeddingModels"]) {
    const inner = obj[key];
    if (Array.isArray(inner)) return uniqueStrings(inner);
  }
  return [];
}

/** Current assignment is always listed, even if the embedding catalog omitted it. */
export function vectorizationModelOptions(current: string | null, listed: string[]): string[] {
  const ids = uniqueStrings(listed);
  if (current && !ids.includes(current)) ids.unshift(current);
  return ids;
}

export function routingFromState(
  state: unknown,
  extras?: { providers?: unknown; modelRoutes?: unknown; router?: unknown; assignments?: unknown },
): ZeroclawRoutingState {
  const raw = asRecord(state) ?? {};
  const inner = asRecord(raw.state) ?? raw;
  const router = asRecord(extras?.router) ?? asRecord(inner.router) ?? {};

  const selected_provider =
    pickString(inner, "selected_provider", "selectedProvider") ??
    pickString(router, "selected_provider", "selectedProvider", "provider", "provider_id", "providerId");

  const selected_model =
    pickString(inner, "selected_model", "selectedModel") ??
    pickString(router, "selected_model", "selectedModel", "model", "model_id", "modelId");

  const routeSource = extras?.modelRoutes ?? inner.model_routes ?? inner.modelRoutes;
  const model_routes = unwrapList(routeSource).map(asModel).filter((m): m is RoutableModel => m != null);

  const providerSource = extras?.providers ?? inner.providers;
  const providers = unwrapList(providerSource)
    .map(asProviderId)
    .filter((id): id is string => id != null);

  const fromState = assignmentsFromValue(inner.model_assignments ?? inner.modelAssignments);
  const assignments = overlayAssignments(fromState, extras?.assignments);

  return { selected_provider, selected_model, model_routes, providers, assignments };
}

export function chatSendRouting(state: ZeroclawRoutingState): { provider: string; model: string } {
  return {
    provider: state.selected_provider ?? "",
    model: state.selected_model ?? "",
  };
}

function unwrapNamed(raw: unknown, ...keys: string[]): unknown {
  const js = valueToJs(raw);
  if (!isRecord(js)) return js;
  for (const key of keys) {
    if (js[key] != null) return valueToJs(js[key]);
  }
  return js;
}

export async function loadZeroclawRouting(
  call: CallSubid,
  opts?: { pluginSchema?: unknown },
): Promise<ZeroclawRoutingSnapshot> {
  let schemaSource: unknown = undefined;
  try {
    schemaSource = unwrapNamed(await call(ZEROCLAW_SUBIDS.configSchema, {}), "configSchema", "config_schema", "schema");
  } catch {
    schemaSource = opts?.pluginSchema;
  }
  if (schemaSource == null) schemaSource = opts?.pluginSchema;
  if (schemaSource == null) {
    throw new Error("zeroclaw config schema unavailable");
  }

  const [stateRes, routesRes, providersRes, routerRes, assignmentsRes] = await Promise.all([
    call(ZEROCLAW_SUBIDS.state, {}),
    call(ZEROCLAW_SUBIDS.modelRoutes, {}),
    call(ZEROCLAW_SUBIDS.providers, {}),
    call(ZEROCLAW_SUBIDS.router, {}).catch(() => ({})),
    call(ZEROCLAW_SUBIDS.modelAssignments, {}).catch(() => null),
  ]);

  const schema = routingJsonSchema(schemaSource);
  const state = routingFromState(unwrapNamed(stateRes, "state"), {
    providers: unwrapNamed(providersRes, "providers"),
    modelRoutes: unwrapNamed(routesRes, "modelRoutes", "model_routes"),
    router: unwrapNamed(routerRes, "router"),
    assignments: unwrapNamed(assignmentsRes, "modelAssignments", "model_assignments"),
  });
  return {
    schema,
    populatedSchema: populateRoutingSchema(schema, state),
    state,
  };
}
