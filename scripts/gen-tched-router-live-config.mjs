#!/usr/bin/env node
/**
 * Snapshot `zeroclaw config list` for the ChatOnly settings page.
 * Used when gRPC config_list is denied (missing tched-router.read grant).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LIST_LINE = /^\s+(\S+)\s+=\s+(.*?)\s+\([^)]*\)\s*(?:🔒)?\s*$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(root, "dist/tched-router-live-config.json");

const result = spawnSync("zeroclaw", ["config", "list"], {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
if (result.status !== 0) {
  process.stderr.write(result.stderr || "zeroclaw config list failed\n");
  process.exit(result.status ?? 1);
}

const config = {};
for (const line of result.stdout.split("\n")) {
  const match = LIST_LINE.exec(line);
  if (!match) continue;
  const value = parseListedValue(match[2].trim());
  if (value === undefined) continue;
  setDotted(config, match[1], value);
}

writeFileSync(dest, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`wrote ${dest} (${Object.keys(config).length} top-level keys)\n`);

function parseListedValue(raw) {
  if (raw === "<unset>") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "***MASKED***") return raw;
  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      return JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return raw;
    }
  }
  if (/^-?\d+$/.test(raw) || /^-?\d+\.\d+$/.test(raw)) return Number(raw);
  return raw;
}

function setDotted(target, path, value) {
  const parts = path.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}
