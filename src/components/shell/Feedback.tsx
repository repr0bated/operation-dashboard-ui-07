/**
 * Shared feedback surfaces: error banners and empty states.
 * Use these to honestly convey backend state — no mock data fallbacks.
 */
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function ErrorBanner({
  title = "Backend unavailable",
  message,
  className,
}: {
  title?: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="font-semibold text-destructive">{title}</div>
        <div className="text-destructive/80 font-mono break-all">{message}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/10 px-6 py-10 text-center",
        className,
      )}
    >
      <Icon className="h-6 w-6 text-muted-foreground/60" />
      <div className="text-sm font-medium text-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground max-w-md">{hint}</div>}
    </div>
  );
}
