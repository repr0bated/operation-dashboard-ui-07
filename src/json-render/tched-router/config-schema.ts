import type { JsonSchema } from "@/types/api";

export const MASKED_SECRET = "***MASKED***";

/** Known serde/schema key drift between the CLI schema and PatchConfig. */
const SECTION_ALIASES: Record<string, string[]> = {
  channels: ["channels_config"],
  channels_config: ["channels"],
  providers: ["model_providers"],
  model_providers: ["providers"],
};

export interface SchemaNode extends JsonSchema {
  $ref?: string;
  $defs?: Record<string, SchemaNode>;
  const?: unknown;
  "x-secret"?: boolean;
}

export interface ConfigSection {
  key: string;
  label: string;
  description: string | null;
  schema: JsonSchema;
}

export function isMaskedSecret(value: unknown): boolean {
  return value === MASKED_SECRET;
}

export function sectionLabel(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Zeroclaw HTTP/stdio MCP client is off; tools live on D-Bus. Hide from the editor. */
const HIDDEN_SECTIONS = new Set(["mcp", "mcp_bundles"]);

export function sectionKeys(root: SchemaNode): string[] {
  return Object.keys(root.properties ?? {})
    .filter((key) => !HIDDEN_SECTIONS.has(key))
    .sort((a, b) => a.localeCompare(b));
}

export function listSections(root: SchemaNode): ConfigSection[] {
  return sectionKeys(root).map((key) => {
    const raw = (root.properties ?? {})[key] as SchemaNode | undefined;
    const schema = sectionSchema(root, key);
    return {
      key,
      label: sectionLabel(key),
      description: typeof schema.description === "string"
        ? schema.description
        : typeof raw?.description === "string"
          ? raw.description
          : null,
      schema,
    };
  });
}

export function sectionSchema(root: SchemaNode, key: string): JsonSchema {
  const raw = (root.properties ?? {})[key] as SchemaNode | undefined;
  if (!raw) return { type: "object", properties: {} };
  const resolved = normalize(root, raw, new Set());
  return {
    ...resolved,
    title: typeof resolved.title === "string" ? resolved.title : sectionLabel(key),
  };
}

export function lookupSectionValue(
  config: Record<string, unknown> | null | undefined,
  key: string,
): unknown {
  if (!config) return undefined;
  if (key in config) return config[key];
  for (const alias of SECTION_ALIASES[key] ?? []) {
    if (alias in config) return config[alias];
  }
  return undefined;
}

export function patchSectionKey(key: string): string {
  if (key === "channels") return "channels_config";
  if (key === "providers") return "model_providers";
  return key;
}

/** Restore unchanged masked leaves from `existing` so PatchConfig can write. */
export function restoreMasked(incoming: unknown, existing: unknown): unknown {
  if (isMaskedSecret(incoming)) return existing;
  if (Array.isArray(incoming)) {
    const prior = Array.isArray(existing) ? existing : [];
    return incoming.map((item, index) => restoreMasked(item, prior[index]));
  }
  if (isPlainObject(incoming)) {
    const prior = isPlainObject(existing) ? existing : {};
    return Object.fromEntries(
      Object.entries(incoming).map(([key, value]) => [
        key,
        restoreMasked(value, prior[key]),
      ]),
    );
  }
  return incoming;
}

export function containsMasked(value: unknown): boolean {
  if (isMaskedSecret(value)) return true;
  if (Array.isArray(value)) return value.some(containsMasked);
  if (isPlainObject(value)) return Object.values(value).some(containsMasked);
  return false;
}

export function normalize(root: SchemaNode, node: SchemaNode, seen: Set<string>): JsonSchema {
  const derefed = deref(root, node, seen);
  return normalizeShape(root, derefed, seen);
}

function deref(root: SchemaNode, node: SchemaNode, seen: Set<string>): SchemaNode {
  if (!node.$ref) return node;
  const name = node.$ref.replace("#/$defs/", "");
  if (seen.has(name)) {
    return { type: "object", description: `circular reference: ${name}` };
  }
  const def = root.$defs?.[name];
  if (!def) {
    return { type: "object", description: `unresolved $ref: ${name}` };
  }
  const nextSeen = new Set(seen);
  nextSeen.add(name);
  const merged: SchemaNode = {
    ...def,
    description: node.description ?? def.description,
    default: node.default !== undefined ? node.default : def.default,
    title: node.title ?? def.title,
    "x-secret": node["x-secret"] ?? def["x-secret"],
  };
  return deref(root, merged, nextSeen);
}

function normalizeShape(root: SchemaNode, node: SchemaNode, seen: Set<string>): JsonSchema {
  const unwrapped = unwrapNullUnion(node);
  const asEnum = constOneOfToEnum(unwrapped);
  const secret = Boolean(asEnum["x-secret"]);
  const next: SchemaNode = {
    ...asEnum,
    type: Array.isArray(asEnum.type) ? asEnum.type.find((item) => item !== "null") : asEnum.type,
    format: secret ? "password" : asEnum.format,
  };

  if (next.properties) {
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, child]) => [
        key,
        normalize(root, child as SchemaNode, seen),
      ]),
    );
  }
  if (next.items && typeof next.items === "object") {
    next.items = normalize(root, next.items as SchemaNode, seen);
  }
  if (next.additionalProperties && typeof next.additionalProperties === "object") {
    next.additionalProperties = normalize(
      root,
      next.additionalProperties as SchemaNode,
      seen,
    );
  }
  if (Array.isArray(next.oneOf)) {
    next.oneOf = next.oneOf.map((branch) => normalize(root, branch as SchemaNode, seen));
  }
  if (Array.isArray(next.anyOf)) {
    next.anyOf = next.anyOf.map((branch) => normalize(root, branch as SchemaNode, seen));
  }
  return next;
}

function unwrapNullUnion(node: SchemaNode): SchemaNode {
  const types = Array.isArray(node.type) ? node.type : null;
  if (types?.includes("null") && types.length === 2) {
    return { ...node, type: types.find((item) => item !== "null") };
  }
  const branches = node.anyOf ?? node.oneOf;
  if (!branches || branches.length !== 2) return node;
  const nullBranch = branches.find((branch) => (branch as SchemaNode).type === "null");
  const valueBranch = branches.find((branch) => (branch as SchemaNode).type !== "null");
  if (nullBranch && valueBranch) {
    return { ...(valueBranch as SchemaNode), description: node.description ?? (valueBranch as SchemaNode).description };
  }
  return node;
}

function constOneOfToEnum(node: SchemaNode): SchemaNode {
  if (!Array.isArray(node.oneOf) || node.oneOf.length === 0) return node;
  const consts = node.oneOf
    .map((branch) => (branch as SchemaNode).const)
    .filter((value): value is string => typeof value === "string");
  if (consts.length !== node.oneOf.length) return node;
  return {
    type: "string",
    enum: consts,
    description: node.description,
    default: node.default,
    title: node.title,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const LIST_LINE = /^\s+(\S+)\s+=\s+(.*?)\s+\([^)]*\)\s*(?:🔒)?\s*$/;

/** Parse `zeroclaw config list` text into a nested object. */
export function parseConfigList(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const match = LIST_LINE.exec(line);
    if (!match) continue;
    const [, path, raw] = match;
    const value = parseListedValue(raw.trim());
    if (value === undefined) continue;
    setDotted(root, path, value);
  }
  return liftNamedMaps(root);
}

/** CLI list text is dotted (`mcp.servers.compact.url`); the editor wants arrays. */
const NAMED_MAPS: Array<{ path: string[]; keyField: string }> = [
  { path: ["mcp", "servers"], keyField: "name" },
  { path: ["model_routes"], keyField: "hint" },
  { path: ["embedding_routes"], keyField: "hint" },
];

export function liftNamedMaps(root: Record<string, unknown>): Record<string, unknown> {
  return NAMED_MAPS.reduce(
    (current, map) => liftAtPath(current, map.path, map.keyField),
    root,
  );
}

function liftAtPath(
  root: Record<string, unknown>,
  path: string[],
  keyField: string,
): Record<string, unknown> {
  const [head, ...rest] = path;
  if (!head) return root;
  if (rest.length === 0) {
    const lifted = objectMapToNamedArray(root[head], keyField);
    return lifted === root[head] ? root : { ...root, [head]: lifted };
  }
  const child = root[head];
  if (!isPlainObject(child)) return root;
  const nextChild = liftAtPath(child, rest, keyField);
  return nextChild === child ? root : { ...root, [head]: nextChild };
}

function objectMapToNamedArray(value: unknown, keyField: string): unknown {
  if (Array.isArray(value) || !isPlainObject(value)) return value;
  return Object.entries(value).map(([key, item]) => ({
    ...(isPlainObject(item) ? item : {}),
    [keyField]: key,
  }));
}

export function flattenLeaves(
  value: unknown,
  prefix = "",
): Array<{ path: string; value: unknown }> {
  if (Array.isArray(value)) {
    if (value.every((item) => isPlainObject(item) && naturalKeyOf(item))) {
      return value.flatMap((item) => {
        const record = item as Record<string, unknown>;
        const key = naturalKeyOf(record);
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        return Object.entries(record)
          .filter(([field]) => field !== "name" && field !== "hint")
          .flatMap(([field, child]) => flattenLeaves(child, `${nextPrefix}.${field}`));
      });
    }
    return prefix ? [{ path: prefix, value }] : [];
  }
  if (!isPlainObject(value)) {
    return prefix ? [{ path: prefix, value }] : [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenLeaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

function naturalKeyOf(item: Record<string, unknown>): string {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (name) return name;
  const hint = typeof item.hint === "string" ? item.hint.trim() : "";
  return hint;
}

function parseListedValue(raw: string): unknown {
  if (raw === "<unset>") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === MASKED_SECRET || raw.includes("🔒")) return MASKED_SECRET;
  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      return JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return raw;
    }
  }
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);
  return raw;
}

export type McpTransport = "stdio" | "http" | "sse";

export interface McpServer {
  name: string;
  transport: McpTransport;
  command: string;
  args: string[];
  url: string | null;
  env: Record<string, string>;
  headers: Record<string, string>;
  pinned_resources: string[];
  tool_timeout_secs: number | null;
}

export function emptyMcpServer(name: string): McpServer {
  return {
    name,
    transport: "stdio",
    command: "",
    args: [],
    url: null,
    env: {},
    headers: {},
    pinned_resources: [],
    tool_timeout_secs: null,
  };
}

export function mcpServersFromSection(section: unknown): McpServer[] {
  const record = isPlainObject(section) ? section : {};
  const raw = record.servers;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!isPlainObject(entry)) return null;
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      if (!name) return null;
      const transport =
        entry.transport === "http" || entry.transport === "sse" ? entry.transport : "stdio";
      return {
        name,
        transport,
        command: typeof entry.command === "string" ? entry.command : "",
        args: Array.isArray(entry.args) ? entry.args.filter((item): item is string => typeof item === "string") : [],
        url: typeof entry.url === "string" ? entry.url : null,
        env: isPlainObject(entry.env)
          ? Object.fromEntries(
              Object.entries(entry.env).filter((item): item is [string, string] => typeof item[1] === "string"),
            )
          : {},
        headers: isPlainObject(entry.headers)
          ? Object.fromEntries(
              Object.entries(entry.headers).filter((item): item is [string, string] => typeof item[1] === "string"),
            )
          : {},
        pinned_resources: Array.isArray(entry.pinned_resources)
          ? entry.pinned_resources.filter((item): item is string => typeof item === "string")
          : [],
        tool_timeout_secs: typeof entry.tool_timeout_secs === "number" ? entry.tool_timeout_secs : null,
      } satisfies McpServer;
    })
    .filter((entry): entry is McpServer => entry !== null);
}

function setDotted(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!isPlainObject(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}
