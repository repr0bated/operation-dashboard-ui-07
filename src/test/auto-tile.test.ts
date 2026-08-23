import { describe, it, expect } from "vitest";
import {
  AUTO_TILE_SPANS,
  AUTO_TILE_SIZE_CLASS,
  autoTileSizeClass,
  autoTileSizeForRole,
  colSpanForCatalogType,
  colSpanForMeasuredWidth,
  colSpanForOverflow,
  compileAutoTileSpec,
  isAutoTileSize,
  packAutoTileLayout,
} from "@/json-render/spec-gen/auto-tile";
import { validateGeneratedSpec } from "@/json-render/spec-gen/validate-spec";
import { CATALOG_COMPONENTS } from "@/json-render/catalog/catalog";
import type { UiRole } from "@/lib/subid-ui";

describe("auto-tile spans", () => {
  it("packs a 12-column board without leftover columns for the three sizes", () => {
    expect(AUTO_TILE_SPANS.small.colSpan * 3).toBe(12);
    expect(AUTO_TILE_SPANS.medium.colSpan * 2).toBe(12);
    expect(AUTO_TILE_SPANS.large.colSpan).toBe(12);
  });

  it("maps size hints to CSS classes", () => {
    expect(autoTileSizeClass("small")).toBe(AUTO_TILE_SIZE_CLASS.small);
    expect(autoTileSizeClass(null)).toBe(AUTO_TILE_SIZE_CLASS.small);
    expect(isAutoTileSize("medium")).toBe(true);
    expect(isAutoTileSize("huge")).toBe(false);
  });

  it("picks size from UiRole so generators do not invent spans", () => {
    const cases: Array<[UiRole, string]> = [
      ["display-value", "small"],
      ["numeric-control", "small"],
      ["record-view", "medium"],
      ["collection-view", "large"],
      ["editable-collection", "large"],
    ];
    for (const [role, size] of cases) {
      expect(autoTileSizeForRole(role)).toBe(size);
    }
  });
});

describe("content fit", () => {
  it("gives wide widgets the full board", () => {
    expect(colSpanForCatalogType("overviewStats")).toBe(12);
    expect(colSpanForCatalogType("eventTapePanel")).toBe(12);
    expect(colSpanForCatalogType("eventDistributionPanel")).toBe(6);
  });

  it("gives record widgets half the board", () => {
    expect(colSpanForCatalogType("resourcePanel")).toBe(6);
    expect(colSpanForCatalogType("notesPanel")).toBe(6);
  });

  it("grows columns so measured content fits", () => {
    expect(colSpanForMeasuredWidth(400, 80, 12, 3)).toBe(5);
    expect(colSpanForMeasuredWidth(80, 80, 12, 3)).toBe(3);
    expect(colSpanForMeasuredWidth(2000, 80, 12, 3)).toBe(12);
  });

  it("does not grow when content only fills its own tile", () => {
    expect(colSpanForOverflow(480, 480, 80, 6, 12)).toBe(6);
    expect(colSpanForOverflow(481, 480, 80, 6, 12)).toBe(6);
    expect(colSpanForOverflow(600, 480, 80, 6, 12)).toBe(8);
  });
});

describe("packAutoTileLayout", () => {
  it("places three small tiles on the first row", () => {
    const layout = packAutoTileLayout([
      { id: "a", size: "small" },
      { id: "b", size: "small" },
      { id: "c", size: "small" },
    ]);
    expect(layout).toEqual([
      { i: "a", x: 0, y: 0, w: 4, h: 1 },
      { i: "b", x: 4, y: 0, w: 4, h: 1 },
      { i: "c", x: 8, y: 0, w: 4, h: 1 },
    ]);
  });

  it("wraps a large tile onto the next shelf", () => {
    const layout = packAutoTileLayout([
      { id: "a", size: "medium" },
      { id: "b", size: "large" },
    ]);
    expect(layout[0]).toMatchObject({ i: "a", x: 0, y: 0, w: 6, h: 2 });
    expect(layout[1]).toMatchObject({ i: "b", x: 0, y: 2, w: 12, h: 3 });
  });
});

describe("compileAutoTileSpec", () => {
  it("emits autoTile + autoTileItem wrappers around catalog types", () => {
    const spec = compileAutoTileSpec([
      { id: "uptime", type: "statCard", props: { label: "Uptime", value: "99%" }, size: "small" },
      { id: "router", type: "streamObject", props: { pluginId: "tched_router" }, size: "large" },
    ]);

    expect(spec.root).toBe("autotile");
    const root = spec.elements[spec.root] as { type: string; children: string[] };
    expect(root.type).toBe("autoTile");
    expect(root.children).toEqual(["uptime--tile", "router--tile"]);

    const item = spec.elements["uptime--tile"] as {
      type: string;
      props: { size: string };
      children: string[];
    };
    expect(item.type).toBe("autoTileItem");
    expect(item.props.size).toBe("small");
    expect((item.props as { contentType?: string }).contentType).toBe("statCard");
    expect(item.children).toEqual(["uptime"]);
    expect((spec.elements.uptime as { type: string }).type).toBe("statCard");
  });

  it("rejects unknown catalog types", () => {
    expect(() => compileAutoTileSpec([{ id: "x", type: "NotAComponent" }])).toThrow(
      /not a catalog component/,
    );
  });

  it("produces a spec the client validator accepts", () => {
    const spec = compileAutoTileSpec([
      {
        id: "status",
        type: "stateValue",
        props: { path: "/plugins/tched_router/selected_model", label: "model" },
      },
    ]);
    const result = validateGeneratedSpec(spec);
    expect(result.valid, result.errors.join("; ")).toBe(true);
    const catalog = new Set(CATALOG_COMPONENTS);
    for (const element of Object.values(spec.elements as Record<string, { type: string }>)) {
      expect(catalog.has(element.type)).toBe(true);
    }
  });
});
