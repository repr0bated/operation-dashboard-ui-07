/**
 * Autotile layout math.
 *
 * The LLM (or blob generator) emits a flat list of catalog tiles plus an
 * optional size hint. This module owns columns, spans, and packing. Specs
 * must never carry x/y/col/row coordinates.
 */
import type { Spec } from "@json-render/core";
import { CATALOG_COMPONENTS } from "@/json-render/catalog/catalog";
import type { UiRole } from "@/lib/subid-ui";

export const AUTO_TILE_SIZES = ["small", "medium", "large"] as const;
export type AutoTileSize = (typeof AUTO_TILE_SIZES)[number];

export const AUTO_TILE_COLUMNS = 12;
export const AUTO_TILE_GAP_PX = 16;
export const AUTO_TILE_ROW_PX = 140;

/** 12-column dense-grid spans. Packing is CSS `grid-flow-row-dense`. */
export const AUTO_TILE_SPANS: Record<AutoTileSize, { colSpan: number; rowSpan: number }> = {
  small: { colSpan: 4, rowSpan: 1 },
  medium: { colSpan: 6, rowSpan: 2 },
  large: { colSpan: 12, rowSpan: 3 },
};

export const AUTO_TILE_SIZE_CLASS: Record<AutoTileSize, string> = {
  small: "col-span-4 row-span-1",
  medium: "col-span-6 row-span-2",
  large: "col-span-12 row-span-3",
};

const COL_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

/** Only widgets that are unreadable below a full row. */
const FULL_WIDTH_TYPES = new Set([
  "overviewStats",
  "streamGrid",
  "eventTapePanel",
]);

/** Catalog types that read well at half board. */
const HALF_WIDTH_TYPES = new Set([
  "resourcePanel",
  "gatewayAccess",
  "notesPanel",
  "card",
  "cardEl",
  "recordView",
  "recordEditor",
  "structuredControl",
  "collectionView",
  "eventDistributionPanel",
  "connectedPeersPanel",
  "stateProjectionPanel",
  "rawStatsPanel",
  "componentsPanel",
]);

export function clampColSpan(span: number, columns = AUTO_TILE_COLUMNS): number {
  return Math.min(columns, Math.max(1, Math.round(span)));
}

export function autoTileColSpanClass(span: number): string {
  return COL_SPAN_CLASS[clampColSpan(span)] ?? "col-span-4";
}

/** Starting column span from the widget type — height always follows content. */
export function colSpanForCatalogType(type: string, columns = AUTO_TILE_COLUMNS): number {
  if (FULL_WIDTH_TYPES.has(type)) return columns;
  if (HALF_WIDTH_TYPES.has(type)) return Math.max(4, Math.ceil(columns / 2));
  return Math.max(3, Math.floor(columns / 3));
}

/** Grow a tile so measured content width fits the board columns. */
export function colSpanForMeasuredWidth(
  widthPx: number,
  columnWidthPx: number,
  columns = AUTO_TILE_COLUMNS,
  minSpan = 1,
): number {
  if (columnWidthPx <= 0) return clampColSpan(minSpan, columns);
  return clampColSpan(Math.max(minSpan, Math.ceil(widthPx / columnWidthPx)), columns);
}

/**
 * Only grow when content actually overflows the tile.
 * `width: 100%` children have scrollWidth ≈ clientWidth and must not
 * ratchet up to a full row.
 */
export function colSpanForOverflow(
  scrollWidth: number,
  clientWidth: number,
  columnWidthPx: number,
  currentSpan: number,
  columns = AUTO_TILE_COLUMNS,
): number {
  if (columnWidthPx <= 0 || clientWidth <= 0) return currentSpan;
  if (scrollWidth <= clientWidth + 2) return currentSpan;
  const extra = Math.ceil((scrollWidth - clientWidth) / columnWidthPx);
  return clampColSpan(currentSpan + extra, columns);
}

export function isAutoTileSize(value: unknown): value is AutoTileSize {
  return value === "small" || value === "medium" || value === "large";
}

export function autoTileSizeClass(size: AutoTileSize | null | undefined): string {
  return AUTO_TILE_SIZE_CLASS[size ?? "small"];
}

export function cycleAutoTileSize(size: AutoTileSize | null | undefined): AutoTileSize {
  const order = AUTO_TILE_SIZES;
  const current = size ?? "small";
  return order[(order.indexOf(current) + 1) % order.length];
}

/** Move `fromId` in front of `toId`. If `toId` is missing, append. */
export function reorderTileIds(ids: string[], fromId: string, toId: string): string[] {
  if (fromId === toId || !ids.includes(fromId)) return [...ids];
  const next = ids.filter((id) => id !== fromId);
  const at = next.indexOf(toId);
  if (at < 0) {
    next.push(fromId);
    return next;
  }
  next.splice(at, 0, fromId);
  return next;
}

export type PackedTile = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Shelf-pack size hints onto a 12-col board. react-grid-layout compacts after this. */
export function packAutoTileLayout(
  items: Array<{ id: string; size?: AutoTileSize | null }>,
  columns = AUTO_TILE_COLUMNS,
): PackedTile[] {
  let x = 0;
  let y = 0;
  let rowH = 0;
  const layout: PackedTile[] = [];
  for (const item of items) {
    const span = AUTO_TILE_SPANS[item.size ?? "small"];
    const w = Math.min(span.colSpan, columns);
    const h = span.rowSpan;
    if (x + w > columns) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    layout.push({ i: item.id, x, y, w, h });
    x += w;
    rowH = Math.max(rowH, h);
  }
  return layout;
}

/** Role → footprint. Collections get a large tile; records medium; scalars small. */
export function autoTileSizeForRole(role: UiRole): AutoTileSize {
  switch (role) {
    case "collection-view":
    case "editable-collection":
      return "large";
    case "record-view":
    case "record-editor":
    case "structured-control":
    case "value-list":
      return "medium";
    default:
      return "small";
  }
}

export type AutoTileDecl = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  size?: AutoTileSize;
  on?: Record<string, unknown>;
};

export type CompileAutoTileOptions = {
  rootId?: string;
  columns?: number;
  gap?: number;
  rowHeight?: number;
  boardId?: string | null;
  reorderable?: boolean | null;
  fit?: "content" | "hint" | null;
  className?: string | null;
};

/**
 * Compile a flat tile list into a json-render Spec.
 * Root is `autoTile`; each tile is wrapped in `autoTileItem` so size stays
 * off the inner catalog component.
 */
export function compileAutoTileSpec(
  tiles: AutoTileDecl[],
  options: CompileAutoTileOptions = {},
): Spec {
  const catalog = new Set(CATALOG_COMPONENTS);
  const rootId = options.rootId ?? "autotile";
  const elements: Record<string, Record<string, unknown>> = {};
  const itemIds: string[] = [];

  for (const tile of tiles) {
    if (!catalog.has(tile.type)) {
      throw new Error(`autoTile: "${tile.type}" is not a catalog component`);
    }
    if (tile.type === "autoTile" || tile.type === "autoTileItem") {
      throw new Error(`autoTile: do not nest ${tile.type} inside a tile list`);
    }
    const itemId = `${tile.id}--tile`;
    itemIds.push(itemId);
    elements[itemId] = {
      type: "autoTileItem",
      props: {
        size: tile.size ?? null,
        contentType: tile.type,
        tileId: itemId,
        className: null,
      },
      children: [tile.id],
    };
    elements[tile.id] = {
      type: tile.type,
      props: tile.props ?? {},
      ...(tile.on ? { on: tile.on } : {}),
    };
  }

  elements[rootId] = {
    type: "autoTile",
    props: {
      columns: options.columns ?? AUTO_TILE_COLUMNS,
      gap: options.gap ?? AUTO_TILE_GAP_PX,
      rowHeight: options.rowHeight ?? AUTO_TILE_ROW_PX,
      boardId: options.boardId ?? options.rootId ?? "default",
      reorderable: options.reorderable ?? true,
      fit: options.fit ?? "content",
      className: options.className ?? null,
    },
    children: itemIds,
  };

  return { root: rootId, elements } as Spec;
}

export const AUTO_TILE_PROMPT_RULES = [
  "For any multi-widget dashboard, use autoTile as the layout root (or as the only layout child of container/card). Do not use grid, and do not emit x, y, col, row, or CSS grid-template values.",
  "Put each widget in an autoTileItem. Omit size unless you must pin a footprint; the board sizes tiles to the data (height follows content, columns grow if the widget overflows).",
  "autoTileItem children must be catalog components. Never invent a component type.",
  "Operators may drag tiles to reorder (@dnd-kit, same as examples/dashboard). Never emit pixel positions or freeform spans for that.",
] as const;
