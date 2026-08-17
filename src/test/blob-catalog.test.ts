import { describe, expect, it } from "vitest";
import { mergeBlobCatalogPluginIds } from "@/hooks/use-blob-catalog";

describe("sealed blob catalog", () => {
  it("does not let a partial schema stream hide manifest plugins", () => {
    expect(
      mergeBlobCatalogPluginIds(
        ["adc", "btrfs", "network", "tched_router"],
        ["network", "tched_router"],
      ),
    ).toEqual(["adc", "btrfs", "network", "tched_router"]);
  });

  it("adds a newly streamed contract before the manifest refresh completes", () => {
    expect(mergeBlobCatalogPluginIds(["adc", "btrfs"], ["adc", "cozo"])).toEqual([
      "adc",
      "btrfs",
      "cozo",
    ]);
  });
});
