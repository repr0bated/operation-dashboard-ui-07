/**
 * Spec Generation Module
 *
 * Exports for generating and validating json-render specs from plugin projections.
 */
export { generatePluginPageSpec } from "./generate-plugin-page";
export { validateGeneratedSpec, type ValidationResult } from "./validate-spec";
export { usePluginPageSpec, type UsePluginPageSpecResult } from "./use-plugin-page-spec";
export {
  compileAutoTileSpec,
  autoTileSizeForRole,
  autoTileSizeClass,
  autoTileColSpanClass,
  colSpanForCatalogType,
  colSpanForMeasuredWidth,
  colSpanForOverflow,
  packAutoTileLayout,
  AUTO_TILE_PROMPT_RULES,
  AUTO_TILE_SPANS,
  type AutoTileDecl,
  type AutoTileSize,
} from "./auto-tile";
