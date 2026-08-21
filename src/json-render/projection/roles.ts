/**
 * ui_projection.role (kebab-case, from op_state_store::UiRole) → catalog type.
 *
 * Roles are presentation semantics, not json-render names. This table is the
 * client step that was missing: a catalog-gated renderer can only paint types
 * declared in catalog.ts, so every role must resolve to one of those names.
 */
export const ROLE_TO_CATALOG = {
  surface: "surface",
  "display-value": "displayValue",
  "state-flag": "stateFlag",
  "collection-view": "collectionView",
  "record-view": "recordView",
  "value-list": "valueList",
  "binary-control": "binaryControl",
  "text-control": "textControl",
  "numeric-control": "numericControl",
  "multi-choice": "multiChoice",
  "editable-collection": "editableCollection",
  "record-editor": "recordEditor",
  "structured-control": "structuredControl",
  "validation-carrier": "validationCarrier",
  "hydration-source": "hydrationSource",
  "trigger-binding": "triggerBinding",
  "repeat-binding": "repeatBinding",
} as const;

export type UiProjectionRole = keyof typeof ROLE_TO_CATALOG;
export type ProjectionCatalogType = (typeof ROLE_TO_CATALOG)[UiProjectionRole];

export const PROJECTION_CATALOG_TYPES = Object.values(ROLE_TO_CATALOG);

/** Eight roles observed on live antigravity (SIGNALS 2026-08-16). */
export const LIVE_PROJECTION_ROLES = [
  "surface",
  "structured-control",
  "validation-carrier",
  "display-value",
  "record-editor",
  "text-control",
  "editable-collection",
  "record-view",
] as const satisfies ReadonlyArray<UiProjectionRole>;

export function catalogTypeForRole(role: string): ProjectionCatalogType {
  return (ROLE_TO_CATALOG as Record<string, ProjectionCatalogType>)[role] ?? "displayValue";
}
