/**
 * Banner shown when gRPC ServerReflection returns nothing (or fails) and the
 * UI is driving its method picker from compiled protobuf-ts codecs instead.
 */
import { PlugZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReflectionFallbackBanner({
  reason,
  serviceCount,
  methodCount,
  onRetry,
  retrying,
  className,
}: {
  reason?: string | null;
  serviceCount: number;
  methodCount: number;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs",
        className,
      )}
    >
      <PlugZap className="h-4 w-4 text-warning shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-warning">
          Live reflection empty — using compiled codecs
        </div>
        <div className="text-muted-foreground">
          The server exposed no service descriptors, so the picker falls back to{" "}
          <span className="font-mono">{serviceCount}</span> compiled services ·{" "}
          <span className="font-mono">{methodCount}</span> methods.
        </div>
        {reason && (
          <div className="mt-1 font-mono break-all text-muted-foreground/80">{reason}</div>
        )}
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={retrying}
          className="h-6 gap-1.5 shrink-0"
        >
          <RefreshCw className={cn("h-3 w-3", retrying && "animate-spin")} />
          Retry
        </Button>
      )}
    </div>
  );
}
