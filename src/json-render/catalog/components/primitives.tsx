/**
 * Generic data primitives: the vocabulary used by machine-generated specs
 * (gRPC stream payloads, sealed PluginSchema pages) where the shape of the
 * data is unknown until runtime.
 *
 * Ported verbatim from the previous `lib/json-render-catalog.tsx` renderers;
 * only the call signature changed (`element.props` → `props`).
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { El } from "./types";

export const ContainerEl: El<"container"> = ({ props, children }) => (
  <div className={props.className ?? "space-y-1"}>{children}</div>
);

export const CardEl: El<"card"> = ({ props, children }) => {
  const tone = props.tone ?? "default";
  return (
    <div
      className={cn(
        "rounded-md border bg-card/40 p-3 space-y-2",
        tone === "ok" && "border-ok/30",
        tone === "warn" && "border-warn/30",
        tone === "danger" && "border-danger/30",
        tone === "default" && "border-border",
        props.className,
      )}
    >
      {(props.title || props.subtitle) && (
        <div>
          {props.title ? (
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {props.title}
            </div>
          ) : null}
          {props.subtitle ? (
            <div className="text-[13px] text-muted-foreground mt-1">{props.subtitle}</div>
          ) : null}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
};

export const KvEl: El<"kv"> = ({ props }) => {
  const { label, value, kind } = props;
  const cls =
    kind === "number"
      ? "text-info"
      : kind === "boolean"
        ? value
          ? "text-ok"
          : "text-danger"
        : kind === "string"
          ? "text-warn"
          : kind === "null"
            ? "text-muted-foreground italic"
            : "text-foreground";
  return (
    <div className="flex items-baseline gap-2 font-mono text-xs min-w-0">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={cn("break-all", cls)}>
        {value === null || value === undefined
          ? "null"
          : typeof value === "string"
            ? value === ""
              ? "(empty)"
              : `"${value}"`
            : String(value)}
      </span>
    </div>
  );
};

export const HeadingEl: El<"heading"> = ({ props }) => {
  const level = props.level ?? 2;
  const cls =
    level === 1
      ? "text-sm font-semibold text-foreground"
      : level === 2
        ? "text-xs font-semibold text-foreground uppercase tracking-wider"
        : "text-[11px] font-medium text-muted-foreground uppercase tracking-wider";
  return <div className={cls}>{props.text}</div>;
};

export const TextEl: El<"text"> = ({ props }) => (
  <div className={props.className ?? "text-xs text-foreground font-mono break-all"}>{props.text}</div>
);

export const BadgeEl: El<"badge"> = ({ props }) => {
  const tone = props.tone ?? "default";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-mono",
        tone === "ok" && "border-ok/40 text-ok",
        tone === "warn" && "border-warn/40 text-warn",
        tone === "danger" && "border-danger/40 text-danger",
        tone === "info" && "border-info/40 text-info",
      )}
    >
      {props.text ?? props.label}
    </Badge>
  );
};

export const RowEl: El<"row"> = ({ props, children }) => (
  <div className={cn("flex flex-wrap items-center gap-1.5", props.className)}>{children}</div>
);

const TREND_ICON: Record<string, string> = { up: "\u2191", down: "\u2193", flat: "\u2192" };

export const StatEl: El<"stat"> = ({ props }) => {
  const { label, value, unit, trend } = props;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">
        {value}
        {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
        {trend && <span className="text-sm ml-1">{TREND_ICON[trend] ?? ""}</span>}
      </span>
    </div>
  );
};

export const CodeEl: El<"code"> = ({ props }) => (
  <pre className="font-mono text-[11px] bg-muted/30 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap text-muted-foreground">
    {props.content}
  </pre>
);
