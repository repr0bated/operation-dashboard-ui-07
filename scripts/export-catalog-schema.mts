/**
 * Emit the catalog as a JSON artifact for consumers that cannot evaluate Zod.
 *
 * `appCatalog` is the only place this app's component vocabulary is declared.
 * A Rust consumer (op-gallery-gen's admission gate) has to answer the same
 * question the renderer answers — "may this spec contain this?" — and the wrong
 * way to do that is to restate the vocabulary in Rust, because then two
 * declarations can disagree and the gate admits what the renderer refuses. So
 * the catalog exports itself and Rust validates against the export.
 *
 * What is exported, and why not `catalog.jsonSchema()`:
 *   - `jsonSchema({ strict: true })` collapses `elements` to an opaque object,
 *     because a Record type cannot be strict (documented in JsonSchemaOptions).
 *   - `jsonSchema()` keeps the component-name enum but types props as
 *     `additionalProperties: {}`, i.e. anything, and requires every element key
 *     including `visible`.
 *   Neither can reject a bad prop, so this emits the per-component prop schemas
 *   that the catalog actually declares, converted with Zod's own exporter.
 *
 * Three files, on purpose:
 *   catalog.schema.json    the exact bytes a validator compiles
 *   catalog.prompt.md      the catalog's own system prompt, for generators
 *   catalog.manifest.json  their sha256, plus names and counts, for staleness
 *
 * The digest covers the schema file byte-for-byte, so neither side needs a
 * canonicalizer and there is nothing to disagree about.
 *
 * Usage: npx vite-node scripts/export-catalog-schema.mts [outDir]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { VisibilityConditionSchema } from "@json-render/core";
import { z } from "zod";

import { appCatalog } from "../src/json-render/catalog";

// Read rather than require: @json-render/core does not export ./package.json.
const coreVersion: string = JSON.parse(
  readFileSync(resolve("node_modules/@json-render/core/package.json"), "utf8"),
).version;

const outDir = resolve(
  process.argv[2] ?? process.env.OPDBUS_JSON_RENDER_DIR ?? "/srv/git/odbus/schemas/json-render",
);

const toJson = (schema: unknown) =>
  z.toJSONSchema(schema as z.ZodType, {
    io: "input",
    // A catalog may declare a prop the JSON Schema dialect cannot express.
    // Emitting `any` for it keeps the export lossless in shape while leaving
    // that one prop unconstrained, rather than failing the whole export.
    unrepresentable: "any",
    cycles: "ref",
    reused: "ref",
  });

type CatalogData = {
  components: Record<string, { props: unknown; slots?: string[]; description?: string }>;
  actions: Record<string, { params?: unknown; description?: string }>;
};
const data = (appCatalog as unknown as { data: CatalogData }).data;

const components: Record<string, unknown> = {};
for (const [name, def] of Object.entries(data.components)) {
  components[name] = {
    props: toJson(def.props),
    // `slots` is the children contract: an empty list means the component is a
    // leaf, so children on it are a rejection rather than a rendering quirk.
    slots: def.slots ?? [],
    description: def.description ?? null,
  };
}

const actions: Record<string, unknown> = {};
for (const [name, def] of Object.entries(data.actions ?? {})) {
  actions[name] = { params: def.params ? toJson(def.params) : null };
}

const artifact = {
  generatedBy: "scripts/export-catalog-schema.mts",
  jsonRenderVersion: coreVersion,
  components,
  actions,
  // Element-level `visible` is the one part of the element shape with a real
  // exported schema, so it travels with the catalog instead of being restated.
  visibility: toJson(VisibilityConditionSchema),
};

const schemaBytes = JSON.stringify(artifact);
const schemaSha256 = createHash("sha256").update(schemaBytes).digest("hex");

// The catalog also knows how to teach itself to a model: `prompt()` describes
// the output contract, the directives, the state model and every available
// component. A generator that is told the vocabulary any other way is being
// told a second version of it, which is how a generator ends up emitting
// components the renderer does not have.
//
// `standalone` is the non-conversational mode: JSONL patches, no prose.
const promptText = appCatalog.prompt({ mode: "standalone" });
const promptSha256 = createHash("sha256").update(promptText).digest("hex");

const manifest = {
  generatedBy: "scripts/export-catalog-schema.mts",
  jsonRenderVersion: coreVersion,
  componentCount: Object.keys(components).length,
  actionCount: Object.keys(actions).length,
  componentNames: appCatalog.componentNames,
  actionNames: appCatalog.actionNames,
  promptMode: "standalone",
  schemaSha256,
  promptSha256,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "catalog.schema.json"), schemaBytes);
writeFileSync(join(outDir, "catalog.prompt.md"), promptText);
writeFileSync(join(outDir, "catalog.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`catalog schema   -> ${join(outDir, "catalog.schema.json")}`);
console.log(`catalog prompt   -> ${join(outDir, "catalog.prompt.md")}`);
console.log(`catalog manifest -> ${join(outDir, "catalog.manifest.json")}`);
console.log(
  `json-render ${coreVersion} · ${manifest.componentCount} components · ` +
    `${manifest.actionCount} actions · schema ${schemaBytes.length}B sha256 ${schemaSha256.slice(0, 16)} · ` +
    `prompt ${promptText.length}B sha256 ${promptSha256.slice(0, 16)}`,
);
