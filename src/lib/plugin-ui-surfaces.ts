import type { Spec } from "@json-render/core";
import { schemaToSpec } from "@/components/PluginPage";
import { resolveApiBase } from "@/lib/api";

export interface PluginUiSurface {
  name: string;
  path: string;
  schema: string;
}

export interface PluginSchemaEnvelope {
  plugin: string;
  schema_hash?: string;
  schema: unknown;
}

export interface SealedPluginGalleryEntry {
  id: string;
  plugin: string;
  spec: Spec;
  schema_hash?: string;
}

export interface AntigravityGallerySurface {
  id: string;
  name: string;
  path: string;
  schema: string;
  spec: Spec;
}

export interface AntigravityGalleryBundle {
  schema_hash?: string;
  surfaces: AntigravityGallerySurface[];
}

interface PluginSchemaEnvelopeShape {
  schema?: {
    fields?: {
      ui_surfaces?: {
        default?: unknown;
      };
    };
  };
}

interface SchemaField {
  field_type?: string | Record<string, unknown>;
  description?: string | null;
  required?: boolean;
  read_only?: boolean;
  default?: unknown;
}

interface SchemaMethod {
  name?: string;
  side_effect?: string;
  subid?: string;
  required_capability?: string | null;
  idempotent?: boolean;
}

interface PluginSchemaShape {
  name?: string;
  display_name?: string | null;
  version?: string;
  category?: string;
  description?: string;
  tags?: string[];
  dependencies?: string[];
  fields?: Record<string, SchemaField> | SchemaField[];
  methods?: Record<string, SchemaMethod> | SchemaMethod[];
  guarantees?: Record<string, boolean>;
}

/** Read ui_surfaces.default from a sealed plugin schema envelope. */
export function parsePluginUiSurfaces(payload: unknown): PluginUiSurface[] {
  const raw = (payload as PluginSchemaEnvelopeShape | null)?.schema?.fields?.ui_surfaces?.default;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const route = value as Record<string, unknown>;
    if (
      typeof route.name !== "string" ||
      typeof route.path !== "string" ||
      typeof route.schema !== "string"
    ) {
      return [];
    }
    return [{ name: route.name, path: route.path, schema: route.schema }];
  });
}

export async function fetchPluginSchema(plugin: string): Promise<PluginSchemaEnvelope> {
  const response = await fetch(
    `${resolveApiBase()}/ui-model/plugin-schema/${encodeURIComponent(plugin)}`,
  );
  if (!response.ok) throw new Error(`${plugin} schema HTTP ${response.status}`);
  return response.json() as Promise<PluginSchemaEnvelope>;
}

export async function fetchPluginUiSurfaces(plugin: string): Promise<PluginUiSurface[]> {
  const envelope = await fetchPluginSchema(plugin);
  return parsePluginUiSurfaces(envelope);
}

/** Render the sealed PluginSchema blob through the shared schema → spec builder. */
export function sealedPluginSpec(plugin: string, envelope: PluginSchemaEnvelope): Spec {
  return schemaToSpec(envelope.schema as PluginSchemaShape, plugin);
}

/** Plugins that exist as sealed blobs but declare no json-render UI surfaces. */
export const PLUGINS_WITHOUT_UI_SURFACES = new Set(["antigravity_chat"]);

/** Map gallery catalog ids like `antigravity-blob-render` → sealed plugin id. */
export function pluginIdFromBlobRenderCatalogId(catalogId: string): string | null {
  if (catalogId === "antigravity-blob-render") return "antigravity";
  if (catalogId === "antigravity_chat-blob-render" || catalogId === "antigravity-chat-blob-render") {
    return "antigravity_chat";
  }
  const match = catalogId.match(/^(.+)-blob-render$/);
  if (!match) return null;
  return match[1].replace(/-/g, "_");
}

export function isRenderableGalleryPlugin(pluginId: string): boolean {
  return !PLUGINS_WITHOUT_UI_SURFACES.has(pluginId);
}

function entriesOf<T>(v: Record<string, T> | T[] | undefined): Array<[string, T]> {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((item, i) => [((item as { name?: string }).name ?? String(i)), item]);
  }
  return Object.entries(v);
}

const ANTIGRAVITY_SURFACE_FIELDS: Record<string, string[] | null> = {
  antigravity: null,
  "antigravity.safety": ["safety_settings"],
  "antigravity.usage": ["usage"],
  "antigravity.auth": ["auth"],
};

const ANTIGRAVITY_SURFACE_METHODS: Record<string, string[]> = {
  antigravity: ["get_auth_status", "get_usage_report", "configure_safety"],
  "antigravity.safety": ["configure_safety"],
  "antigravity.usage": ["get_usage_report"],
  "antigravity.auth": ["get_auth_status"],
};

/** Render one Antigravity ui_surface from the sealed blob, not route metadata. */
export function antigravityUiSurfaceSpec(
  envelope: PluginSchemaEnvelope,
  surface: PluginUiSurface,
): Spec {
  const full = envelope.schema as PluginSchemaShape;
  const fieldKeys = ANTIGRAVITY_SURFACE_FIELDS[surface.schema];
  const methodKeys = ANTIGRAVITY_SURFACE_METHODS[surface.schema] ?? [];

  if (fieldKeys === null) {
    return schemaToSpec(full, surface.schema);
  }

  const allFields = entriesOf<SchemaField>(full.fields);
  const fields = Object.fromEntries(
    allFields.filter(([name]) => fieldKeys.includes(name)),
  );

  const allMethods = entriesOf<SchemaMethod>(full.methods);
  const methods = Object.fromEntries(
    allMethods.filter(([name]) => methodKeys.includes(name)),
  );

  return schemaToSpec(
    {
      name: surface.schema,
      display_name: surface.name,
      description: `Antigravity UI surface ${surface.path} · JsonRenderer`,
      fields,
      methods,
    },
    surface.schema,
  );
}

/** Antigravity gallery entries from the plugin's own ui_surfaces projection. */
export async function fetchAntigravityGalleryBundle(): Promise<AntigravityGalleryBundle> {
  const envelope = await fetchPluginSchema("antigravity");
  const routes = parsePluginUiSurfaces(envelope);
  if (routes.length === 0) {
    throw new Error("antigravity schema declares no ui_surfaces");
  }

  return {
    schema_hash: envelope.schema_hash,
    surfaces: routes.map((surface) => ({
      id: `antigravity${surface.path}`,
      name: surface.name,
      path: surface.path,
      schema: surface.schema,
      spec: antigravityUiSurfaceSpec(envelope, surface),
    })),
  };
}

/** Gallery entries backed by sealed blob catalog content, not route descriptors. */
export async function fetchSealedPluginGalleryEntries(
  plugins: string[],
): Promise<SealedPluginGalleryEntry[]> {
  const settled = await Promise.allSettled(plugins.map((plugin) => fetchPluginSchema(plugin)));
  const entries: SealedPluginGalleryEntry[] = [];

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const plugin = plugins[index];
    entries.push({
      id: `${plugin}/sealed-blob`,
      plugin,
      spec: sealedPluginSpec(plugin, result.value),
      schema_hash: result.value.schema_hash,
    });
  });

  if (entries.length === 0 && settled.some((result) => result.status === "rejected")) {
    const first = settled.find((result) => result.status === "rejected") as PromiseRejectedResult;
    throw first.reason;
  }

  return entries;
}
