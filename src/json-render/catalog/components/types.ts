/**
 * Typed helper: `El<"navItem">` is the render function signature for the
 * `navItem` catalog entry, with `props` inferred from its zod schema.
 */
import type { InferCatalogComponents } from "@json-render/core";
import type { ComponentFn } from "@json-render/react";
import type { AppCatalog } from "../catalog";

export type CatalogComponentName = keyof InferCatalogComponents<AppCatalog>;

export type El<K extends CatalogComponentName> = ComponentFn<AppCatalog, K>;
