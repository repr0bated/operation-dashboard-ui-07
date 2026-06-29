/**
 * Renders a (potentially growing) list of streamed JSON messages
 * through `@json-render/react` using our shared catalog.
 *
 * Used by the gRPC Explorer to incrementally project server-streaming
 * responses into a structured UI instead of a raw JSON dump.
 */
import { useMemo } from "react";
import { Renderer } from "@json-render/react";
import { jsonRenderRegistry, streamToSpec, dataToSpec } from "@/lib/json-render-catalog";

interface JsonStreamRendererProps {
  messages: unknown[];
  title?: string;
  loading?: boolean;
}

export function JsonStreamRenderer({ messages, title = "stream", loading }: JsonStreamRendererProps) {
  const spec = useMemo(() => streamToSpec(messages, title), [messages, title]);
  if (messages.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-12 font-mono">
        {loading ? "Awaiting first frame…" : "No messages yet."}
      </div>
    );
  }
  return <Renderer spec={spec} registry={jsonRenderRegistry} loading={loading} />;
}

/** Render a single JSON value via the json-render catalog. */
export function JsonValueRenderer({ data, label }: { data: unknown; label?: string }) {
  const spec = useMemo(() => dataToSpec(data, label), [data, label]);
  return <Renderer spec={spec} registry={jsonRenderRegistry} />;
}
