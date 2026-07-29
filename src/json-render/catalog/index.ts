/**
 * Catalog barrel.
 *
 * `appCatalog` is the contract (what specs may contain); `registry` is the
 * implementation (how each entry paints). They are type-checked against each
 * other by `defineRegistry`.
 */
export {
  appCatalog,
  CATALOG_COMPONENTS,
  CATALOG_ACTIONS,
  type AppCatalog,
} from "./catalog";
export { registry, baseRegistry, handlers, executeAction } from "./registry";
