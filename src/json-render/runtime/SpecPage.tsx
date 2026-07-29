/**
 * Renders a single page spec inside the current shell using the catalog
 * registry. Useful for mounting a spec at a route explicitly, when you do not
 * want `PageSpecOutlet`'s pathname lookup.
 */
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { useJsonRender } from "./JsonRenderProvider";

export function SpecPage({ spec }: { spec: Spec }) {
  const { registry } = useJsonRender();
  return <Renderer spec={spec} registry={registry} />;
}
