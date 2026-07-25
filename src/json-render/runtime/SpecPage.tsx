/**
 * Renders a JSON Render page spec inside the current shell using the trusted
 * base registry. Used at the route level to swap a legacy React page for a
 * spec-driven one without touching the router shape.
 */
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { useJsonRender } from "./JsonRenderProvider";

export function SpecPage({ spec }: { spec: Spec }) {
  const { registry } = useJsonRender();
  return <Renderer spec={spec} registry={registry} />;
}
