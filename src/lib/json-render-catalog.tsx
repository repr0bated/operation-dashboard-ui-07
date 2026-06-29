/**
 * @json-render integration: a minimal catalog of presentational
 * components and helpers that map arbitrary JSON data into a flat
 * Spec for `<Renderer>` from `@json-render/react`.
 *
 * This is the shared catalog used by the gRPC Explorer streaming
 * panel and by `JsonRenderer` (rendered mode).
 */
import type { ReactNode } from "react";
import type { ComponentRegistry, Spec } from "@json-render/react";
import type { UIElement } from "@json-render/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Component renderers ────────────────────────────────────────────────────

const Container = ({ children }: { children?: ReactNode }) => (
  <div className="space-y-1">{children}</div>
);

const Card = ({
  element,
  children,
}: {
  element: UIElement<string, { title?: string; tone?: "default" | "ok" | "warn" | "danger" }>;
  children?: ReactNode;
}) => {
  const tone = element.props.tone ?? "default";
  return (
    <div
      className={cn(
        "rounded-md border bg-card/40 p-3 space-y-2",
        tone === "ok" && "border-ok/30",
        tone === "warn" && "border-warn/30",
        tone === "danger" && "border-danger/30",
        tone === "default" && "border-border",
      )}
    >
      {element.props.title && (
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {element.props.title}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
};

const KV = ({
  element,
}: {
  element: UIElement<string, { label: string; value: unknown; kind?: string }>;
}) => {
  const { label, value, kind } = element.props;
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
            ? `"${value}"`
            : String(value)}
      </span>
    </div>
  );
};

const Heading = ({
  element,
}: {
  element: UIElement<string, { text: string; level?: 1 | 2 | 3 }>;
}) => {
  const level = element.props.level ?? 2;
  const cls =
    level === 1
      ? "text-sm font-semibold text-foreground"
      : level === 2
        ? "text-xs font-semibold text-foreground uppercase tracking-wider"
        : "text-[11px] font-medium text-muted-foreground uppercase tracking-wider";
  return <div className={cls}>{element.props.text}</div>;
};

const Text = ({ element }: { element: UIElement<string, { text: string }> }) => (
  <div className="text-xs text-foreground font-mono break-all">{element.props.text}</div>
);

const BadgeEl = ({
  element,
}: {
  element: UIElement<string, { text: string; tone?: "default" | "ok" | "warn" | "danger" | "info" }>;
}) => {
  const tone = element.props.tone ?? "default";
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
      {element.props.text}
    </Badge>
  );
};

const Row = ({ children }: { children?: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-1.5">{children}</div>
);

const Code = ({ element }: { element: UIElement<string, { content: string }> }) => (
  <pre className="font-mono text-[11px] bg-muted/30 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap text-muted-foreground">
    {element.props.content}
  </pre>
);

export const jsonRenderRegistry: ComponentRegistry = {
  container: Container as never,
  card: Card as never,
  kv: KV as never,
  heading: Heading as never,
  text: Text as never,
  badge: BadgeEl as never,
  row: Row as never,
  code: Code as never,
};

// ── Spec builders ───────────────────────────────────────────────────────────

type ElementMap = Record<string, UIElement>;

function add(
  elements: ElementMap,
  prefix: string,
  type: string,
  props: Record<string, unknown>,
  children?: string[],
): string {
  const key = prefix;
  elements[key] = {
    type,
    props,
    ...(children && children.length ? { children } : {}),
  } as UIElement;
  return key;
}

function walk(
  elements: ElementMap,
  data: unknown,
  path: string,
  label?: string,
): string {
  // Primitive leaves → kv
  if (data === null || data === undefined) {
    return add(elements, path, "kv", { label: label ?? "value", value: null, kind: "null" });
  }
  const t = typeof data;
  if (t === "string" || t === "number" || t === "boolean") {
    return add(elements, path, "kv", {
      label: label ?? "value",
      value: data,
      kind: t,
    });
  }

  if (Array.isArray(data)) {
    const childKeys = data.map((v, i) => walk(elements, v, `${path}.${i}`, String(i)));
    return add(
      elements,
      path,
      "card",
      { title: `${label ?? "list"} [${data.length}]` },
      childKeys,
    );
  }

  // object
  const entries = Object.entries(data as Record<string, unknown>);
  const childKeys = entries.map(([k, v]) => walk(elements, v, `${path}.${k}`, k));
  return add(
    elements,
    path,
    "card",
    { title: `${label ?? "object"} {${entries.length}}` },
    childKeys,
  );
}

/** Convert any JSON value into a json-render Spec for `<Renderer>`. */
export function dataToSpec(data: unknown, rootLabel = "root"): Spec {
  const elements: ElementMap = {};
  const rootKey = walk(elements, data, "$", rootLabel);
  return { root: rootKey, elements };
}

/**
 * Convert a list of streamed messages into a Spec.
 * Each message renders as a card prefixed with its sequence number.
 */
export function streamToSpec(messages: unknown[], title = "stream"): Spec {
  const elements: ElementMap = {};
  const childKeys: string[] = [];
  messages.forEach((msg, i) => {
    const path = `$.${i}`;
    childKeys.push(walk(elements, msg, path, `#${i + 1}`));
  });
  const root = "$";
  elements[root] = {
    type: "card",
    props: { title: `${title} · ${messages.length} msgs` },
    children: childKeys,
  } as UIElement;
  return { root, elements };
}
