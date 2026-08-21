import { useStateValue } from "@json-render/react";
import type { El } from "./types";

const TONE_BORDER: Record<string, string> = {
  default: "border-neutral-800",
  ok: "border-emerald-800",
  warn: "border-amber-800",
  danger: "border-red-800",
};

const TONE_TEXT: Record<string, string> = {
  default: "text-neutral-200",
  ok: "text-emerald-300",
  warn: "text-amber-300",
  danger: "text-red-300",
};

const TONE_SURFACE: Record<string, string> = {
  default: "border-neutral-800 bg-neutral-900/40 text-neutral-300",
  ok: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  warn: "border-amber-800 bg-amber-950/40 text-amber-300",
  danger: "border-red-800 bg-red-950/40 text-red-300",
};

const DOT: Record<string, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  error: "bg-red-400",
  offline: "bg-neutral-500",
};

export const Row: El<"row"> = ({ props, children }) => (
  <div className={`flex flex-wrap items-center gap-2 ${props.className ?? ""}`}>{children}</div>
);

export const SplitPane: El<"splitPane"> = ({ props, slots }) => {
  const vertical = (props.direction ?? "vertical") === "vertical";
  return (
    <div
      className={`${vertical ? "flex flex-col" : "flex flex-row"} flex-1 min-h-0 ${props.className ?? ""}`}
    >
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{slots?.start}</div>
      <div
        className={`flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col ${
          vertical ? "border-t border-neutral-800 pt-3 mt-0" : "border-l border-neutral-800 pl-3 ml-0"
        }`}
      >
        {slots?.end}
      </div>
    </div>
  );
};

export const Separator: El<"separator"> = ({ props }) => (
  <hr className={`border-neutral-800 ${props.className ?? ""}`} />
);

export const Heading: El<"heading"> = ({ props }) => {
  const level = props.level ?? 2;
  const cls =
    level === 1
      ? "text-lg font-semibold text-neutral-100"
      : level === 2
        ? "text-sm font-semibold text-neutral-200 uppercase tracking-wider"
        : "text-[11px] font-medium text-neutral-500 uppercase tracking-wider";
  return <div className={cls}>{props.text}</div>;
};

export const Code: El<"code"> = ({ props }) => (
  <pre className="font-mono text-[11px] bg-neutral-950/60 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap text-neutral-400">
    {props.content}
  </pre>
);

export const Pill: El<"pill"> = ({ props }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
      TONE_SURFACE[props.tone ?? "default"]
    }`}
  >
    {props.text}
  </span>
);

export const StatusDot: El<"statusDot"> = ({ props }) => (
  <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${DOT[props.status] ?? DOT.offline}`} />
);

export const HealthPill: El<"healthPill"> = ({ props }) => {
  const connected = Boolean(useStateValue("/connected"));
  const tone = connected ? "ok" : "danger";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${TONE_SURFACE[tone]}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${connected ? DOT.ok : DOT.error}`} />
      <span>{props.label}</span>
      <span className="font-mono">{connected ? props.okText : props.offlineText}</span>
    </span>
  );
};

export const Callout: El<"callout"> = ({ props, children }) => (
  <div className={`rounded-lg border px-4 py-3 text-sm ${TONE_SURFACE[props.tone ?? "default"]}`}>
    {children}
  </div>
);

export const StatusBanner: El<"statusBanner"> = ({ props }) => {
  if (!props.message) return null;
  const tone = props.tone ?? "danger";
  return (
    <div className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-xs ${TONE_SURFACE[tone]}`} role="status">
      <div className="min-w-0">
        {props.title ? <div className="font-semibold mb-0.5">{props.title}</div> : null}
        <div className="font-mono break-all opacity-80">{props.message}</div>
      </div>
    </div>
  );
};

export const EmptyState: El<"emptyState"> = ({ props }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/20 px-6 py-10 text-center">
    <div className="text-sm font-medium text-neutral-200">{props.title}</div>
    {props.hint ? <div className="text-xs text-neutral-500 max-w-md">{props.hint}</div> : null}
  </div>
);

export const StatCard: El<"statCard"> = ({ props }) => (
  <div className={`rounded-lg border bg-neutral-900/50 p-4 ${TONE_BORDER[props.tone ?? "default"]}`}>
    <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{props.label}</div>
    <div className={`mt-1.5 text-2xl font-bold tracking-tight leading-none ${TONE_TEXT[props.tone ?? "default"]}`}>
      {props.value}
    </div>
    {props.sub ? <div className="mt-1 text-xs text-neutral-500">{props.sub}</div> : null}
  </div>
);
