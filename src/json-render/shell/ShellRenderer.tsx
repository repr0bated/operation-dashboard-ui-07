/**
 * Renders `shellSpec` through json-render using the trusted base registry.
 *
 * `children` is exposed as the `content` slot so the shell spec's
 * `contentRegion` element can pick it up.
 */
import type { ReactNode } from "react";
import { Renderer } from "@json-render/react";
import { JsonRenderProvider, useJsonRender } from "@/json-render/runtime/JsonRenderProvider";
import { shellSpec, CONTENT_SLOT } from "./shellSpec";

function ShellSpecRenderer() {
  const { registry } = useJsonRender();
  return <Renderer spec={shellSpec} registry={registry} />;
}

export function ShellRenderer({ children }: { children: ReactNode }) {
  return (
    <JsonRenderProvider slots={{ [CONTENT_SLOT]: children }}>
      <ShellSpecRenderer />
    </JsonRenderProvider>
  );
}
