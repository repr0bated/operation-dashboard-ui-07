/**
 * Stream structured tile data, not JSX and not layout.
 *
 * Same contract as Vercel `streamObject` + `useObject`: the model emits a
 * Zod-shaped JSON payload; the client maps it onto catalog components and
 * `compileAutoTileSpec` owns packing.
 */
import { z } from "zod";
import type { Spec } from "@json-render/core";
import { compileAutoTileSpec, type AutoTileDecl } from "@/json-render/spec-gen/auto-tile";

const nstr = z.string().nullable().optional();

export const TileMetricSchema = z.object({
  kind: z.literal("metric"),
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  sub: nstr,
  tone: z.enum(["default", "ok", "warn", "danger"]).nullable().optional(),
});

export const TileNoteSchema = z.object({
  kind: z.literal("note"),
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const TileKvSchema = z.object({
  kind: z.literal("kv"),
  id: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const TileStatusSchema = z.object({
  kind: z.literal("status"),
  id: z.string(),
  label: z.string(),
  ok: z.boolean(),
});

export const TileBindingSchema = z.object({
  kind: z.literal("binding"),
  id: z.string(),
  path: z.string(),
  label: nstr,
  format: z.enum(["raw", "json", "bytes", "duration"]).nullable().optional(),
});

export const TileTextSchema = z.object({
  kind: z.literal("text"),
  id: z.string(),
  text: z.string(),
});

export const TileHeadingSchema = z.object({
  kind: z.literal("heading"),
  id: z.string(),
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
});

export const TileItemSchema = z.discriminatedUnion("kind", [
  TileMetricSchema,
  TileNoteSchema,
  TileKvSchema,
  TileStatusSchema,
  TileBindingSchema,
  TileTextSchema,
  TileHeadingSchema,
]);

export const TileBoardSchema = z.object({
  title: nstr,
  lead: nstr,
  tiles: z.array(TileItemSchema),
});

export type TileItem = z.infer<typeof TileItemSchema>;
export type TileBoard = z.infer<typeof TileBoardSchema>;

export function tileBoardJsonSchema(): object {
  return z.toJSONSchema(TileBoardSchema);
}

export function tileToDecl(tile: TileItem): AutoTileDecl {
  switch (tile.kind) {
    case "metric":
      return {
        id: tile.id,
        type: "statCard",
        props: {
          label: tile.label,
          value: tile.value,
          sub: tile.sub ?? null,
          variant: tile.tone ?? null,
          tone: tile.tone ?? null,
        },
      };
    case "note":
      return {
        id: tile.id,
        type: "notesPanel",
        props: {
          title: tile.title,
          subtitle: null,
          notes: [{ title: tile.title, desc: tile.body }],
        },
      };
    case "kv":
      return {
        id: tile.id,
        type: "kv",
        props: {
          label: tile.label,
          value: String(tile.value),
          kind: typeof tile.value === "number" ? "number" : "string",
        },
      };
    case "status":
      return {
        id: tile.id,
        type: "pill",
        props: {
          text: `${tile.label}: ${tile.ok ? "ok" : "down"}`,
          variant: tile.ok ? "ok" : "danger",
          tone: tile.ok ? "ok" : "danger",
        },
      };
    case "binding":
      return {
        id: tile.id,
        type: "stateValue",
        props: {
          path: tile.path,
          label: tile.label ?? tile.path,
          format: tile.format ?? "raw",
        },
      };
    case "text":
      return {
        id: tile.id,
        type: "text",
        props: {
          text: tile.text,
          className: "text-sm text-foreground whitespace-pre-wrap",
        },
      };
    case "heading":
      return {
        id: tile.id,
        type: "heading",
        props: {
          text: tile.text,
          level: tile.level ?? 2,
        },
      };
  }
}

export function tileBoardToSpec(board: TileBoard, boardId = "streamed"): Spec {
  const decls = board.tiles.map(tileToDecl);
  const packed = compileAutoTileSpec(decls, {
    rootId: `${boardId}-board`,
    boardId,
    fit: "content",
  });
  const headerIds: string[] = [];
  const extras: Record<string, Record<string, unknown>> = {};
  if (board.title) {
    headerIds.push(`${boardId}-header`);
    extras[`${boardId}-header`] = {
      type: "pageHeader",
      props: { title: board.title, subtitle: null },
    };
  }
  if (board.lead) {
    headerIds.push(`${boardId}-lead`);
    extras[`${boardId}-lead`] = {
      type: "text",
      props: { text: board.lead, className: "text-sm text-muted-foreground whitespace-pre-wrap" },
    };
  }
  if (headerIds.length === 0) return packed;
  return {
    root: `${boardId}-root`,
    elements: {
      [`${boardId}-root`]: {
        type: "container",
        props: { className: "flex flex-col gap-4" },
        children: [...headerIds, packed.root],
      },
      ...extras,
      ...packed.elements,
    },
  } as Spec;
}

function completeTiles(raw: unknown): TileItem[] {
  if (!raw || typeof raw !== "object") return [];
  const tiles = (raw as { tiles?: unknown }).tiles;
  if (!Array.isArray(tiles)) return [];
  const out: TileItem[] = [];
  for (const item of tiles) {
    const parsed = TileItemSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Best-effort parse of a partial streamObject payload. */
export function parseTileBoard(text: string): TileBoard | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const slice = text.slice(start);
  try {
    const parsed = TileBoardSchema.safeParse(JSON.parse(slice));
    if (parsed.success) return parsed.data;
  } catch {
    /* incomplete object — fall through */
  }
  const tilesMatch = slice.match(/"tiles"\s*:\s*\[/);
  if (!tilesMatch || tilesMatch.index == null) return null;
  const from = start + tilesMatch.index + tilesMatch[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    const tiles = JSON.parse(text.slice(from, end + 1));
    const titleMatch = text.match(/"title"\s*:\s*"([^"]*)"/);
    return {
      title: titleMatch?.[1] ?? null,
      lead: text.match(/"lead"\s*:\s*"([^"]*)"/)?.[1] ?? null,
      tiles: completeTiles({ tiles }),
    };
  } catch {
    return null;
  }
}

export function tileObjectSystemPrompt(): string {
  return [
    "You are a data service for the operation dashboard.",
    "Stream a single JSON object. Do not emit JSX, CSS, markdown, or layout fields (no x, y, col, row, grid).",
    "The client maps this object onto catalog tiles and packs them.",
    "Schema:",
    JSON.stringify(tileBoardJsonSchema(), null, 2),
    "Use kind metric | note | kv | status | binding | text | heading.",
    "Mix is allowed: prose tiles (text, heading, lead) next to catalog tiles (metric, kv, status, binding, note).",
    "binding.path must be a live uiStore path such as /plugins/<id>/<field>.",
    "Output only the JSON object.",
  ].join("\n");
}
