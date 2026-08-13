/**
 * Schema-driven view of zeroclaw model routing.
 * Renders the schemars JSON Schema with live GetState values populated —
 * no hardcoded provider/model lists.
 */
import { SchemaRenderer } from "@/components/json/SchemaRenderer";
import { ErrorBanner } from "@/components/shell/Feedback";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import type { ZeroclawRoutingSnapshot } from "@/lib/zeroclaw-routing";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Props {
  snapshot?: ZeroclawRoutingSnapshot | null;
  className?: string;
}

export function ZeroclawRoutingPanel({ snapshot, className }: Props) {
  const live = useZeroclawRouting();
  const snap = snapshot ?? live.snapshot;
  const loading = snapshot ? false : live.loading;
  const error = snapshot ? null : live.error;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Zeroclaw routing</h3>
        <span className="text-[11px] font-mono text-muted-foreground">
          schemars · selected_provider / selected_model
        </span>
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading zeroclaw schema…
        </div>
      )}
      {error && (
        <ErrorBanner title="Zeroclaw routing unavailable" message={error} />
      )}
      {snap && (
        <SchemaRenderer
          schema={snap.schema}
          data={snap.state}
          readOnly
        />
      )}
      {!loading && !error && !snap && (
        <p className="text-xs text-muted-foreground">No zeroclaw routing schema available.</p>
      )}
    </div>
  );
}
