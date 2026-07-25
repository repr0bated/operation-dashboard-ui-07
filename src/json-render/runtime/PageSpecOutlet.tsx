/**
 * Route-aware page-spec outlet.
 *
 * If the current pathname matches a registered spec in `pageSpecs`, render
 * that spec via the base registry. Otherwise fall back to React Router's
 * `<Outlet />` — this keeps every legacy React page working unchanged.
 */
import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Renderer } from "@json-render/react";
import type { Spec } from "@json-render/core";
import { useJsonRender } from "./JsonRenderProvider";
import { overviewSpec } from "@/json-render/pages/overview.pagespec";

/**
 * Path → Spec map. Add new entries as pages are converted.
 * Legacy pages are intentionally absent so they render through the
 * React Router outlet fallback.
 */
export const pageSpecs: Record<string, Spec> = {
  "/": overviewSpec,
};

export function PageSpecOutlet() {
  const { pathname } = useLocation();
  const { registry } = useJsonRender();
  const spec = useMemo(() => pageSpecs[pathname], [pathname]);
  if (spec) return <Renderer spec={spec} registry={registry} />;
  return <Outlet />;
}
