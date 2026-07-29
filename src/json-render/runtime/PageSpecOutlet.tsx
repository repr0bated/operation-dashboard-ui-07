/**
 * Route-aware page outlet.
 *
 * If the current pathname has a registered page spec, render it. Otherwise
 * fall through to React Router's `<Outlet />`, so every not-yet-converted
 * React page keeps working unchanged.
 */
import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Renderer } from "@json-render/react";
import { useJsonRender } from "./JsonRenderProvider";
import { pageSpecFor, PAGE_SPECS } from "@/json-render/pages";

export { PAGE_SPECS };

export function PageSpecOutlet() {
  const { pathname } = useLocation();
  const { registry } = useJsonRender();
  const spec = useMemo(() => pageSpecFor(pathname), [pathname]);
  if (spec) return <Renderer spec={spec} registry={registry} />;
  return <Outlet />;
}
