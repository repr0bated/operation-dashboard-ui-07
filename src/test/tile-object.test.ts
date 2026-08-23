import { describe, it, expect } from "vitest";
import {
  parseTileBoard,
  tileBoardToSpec,
  tileToDecl,
  type TileItem,
} from "@/json-render/generate/tile-object";
import { validateGeneratedSpec } from "@/json-render/spec-gen/validate-spec";

const miami: TileItem = {
  kind: "metric",
  id: "temp",
  label: "Miami",
  value: 84,
  sub: "sunny",
  tone: "ok",
};

describe("tileToDecl", () => {
  it("maps metric data onto statCard, not layout", () => {
    expect(tileToDecl(miami)).toEqual({
      id: "temp",
      type: "statCard",
      props: {
        label: "Miami",
        value: 84,
        sub: "sunny",
        variant: "ok",
        tone: "ok",
      },
    });
  });

  it("maps text onto the catalog text component", () => {
    expect(
      tileToDecl({ kind: "text", id: "intro", text: "Miami is warm." }),
    ).toMatchObject({ id: "intro", type: "text", props: { text: "Miami is warm." } });
  });

  it("maps binding onto stateValue", () => {
    const decl = tileToDecl({
      kind: "binding",
      id: "up",
      path: "/plugins/procfs/uptime",
      label: "Uptime",
      format: "duration",
    });
    expect(decl.type).toBe("stateValue");
    expect(decl.props).toMatchObject({ path: "/plugins/procfs/uptime" });
  });
});

describe("parseTileBoard", () => {
  it("parses a complete streamObject payload", () => {
    const board = parseTileBoard(
      JSON.stringify({ title: "Weather", tiles: [miami] }),
    );
    expect(board?.title).toBe("Weather");
    expect(board?.tiles).toHaveLength(1);
  });

  it("keeps complete tiles from a partial stream", () => {
    const board = parseTileBoard(
      `{"title":"Live","tiles":[{"kind":"metric","id":"a","label":"A","value":1},{"kind":"metric","id":"b"`,
    );
    expect(board).toBeNull();
    const later = parseTileBoard(
      `{"title":"Live","tiles":[{"kind":"metric","id":"a","label":"A","value":1},{"kind":"kv","id":"b","label":"B","value":"x"}]}`,
    );
    expect(later?.tiles.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("tileBoardToSpec", () => {
  it("compiles data into an autoTile spec the validator accepts", () => {
    const spec = tileBoardToSpec(
      {
        title: "Miami",
        lead: "Afternoon sounding.",
        tiles: [miami, { kind: "text", id: "blurb", text: "No storms nearby." }],
      },
      "wx",
    );
    expect(spec.root).toBe("wx-root");
    const types = Object.values(spec.elements as Record<string, { type: string }>).map(
      (el) => el.type,
    );
    expect(types).toContain("autoTile");
    expect(types).toContain("statCard");
    expect(types).toContain("text");
    expect(types).not.toContain("grid");
    const result = validateGeneratedSpec(spec);
    expect(result.valid, result.errors.join("; ")).toBe(true);
  });
});
