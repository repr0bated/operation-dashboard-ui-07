#!/usr/bin/env node
/**
 * Dump `zeroclaw config schema` into the typed json-render schema asset.
 *
 *   node scripts/gen-tched-router-config-schema.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "src/json-render/tched-router/tched-router-config.schema.json");

const result = spawnSync("zeroclaw", ["config", "schema"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || "zeroclaw config schema failed\n");
  process.exit(result.status ?? 1);
}

const schema = JSON.parse(result.stdout);
if (schema.title !== "Config" || !schema.properties || !schema.$defs) {
  throw new Error("unexpected zeroclaw config schema shape");
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(schema, null, 2)}\n`);
process.stdout.write(
  `wrote ${out} (${Object.keys(schema.properties).length} sections, ${Object.keys(schema.$defs).length} defs)\n`,
);
