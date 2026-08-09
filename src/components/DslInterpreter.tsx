/**
 * DSL Interpreter — renders json-render.dev DSL specs
 * Safely interprets declarative UI nodes without eval/DOM-escape/network calls
 */

import React from "react";
import { AlertCircle, TrendingUp, Activity, Zap } from "lucide-react";

// ── DSL Types (from spec) ────────────────────────────────────────────

export type DslNode =
  | { kind: "stack"; axis: "row" | "col"; gap?: number; children: DslNode[] }
  | { kind: "grid"; cols: number; gap?: number; children: DslNode[] }
  | { kind: "text"; value: string; tone?: "default" | "muted" | "accent" | "danger" }
  | { kind: "value"; value: string | number; format?: "number" | "bytes" | "duration_ms" | "percent" }
  | { kind: "spark"; label: string; trend: number }
  | { kind: "chip"; label: string; intent?: "info" | "warn" | "ok" | "danger" }
  | { kind: "action"; label: string; disabled?: boolean }
  | { kind: "panel"; title?: string; children: DslNode[] }
  | { kind: "list"; items: string[]; key?: string }
  | { kind: "when"; condition: boolean; then: DslNode; else?: DslNode }
  | { kind: "diagnostic"; reason: string };

export interface RenderCtx {
  depth?: number;
  maxDepth?: number;
  diagnosticCount?: number;
}

// ── Tone Mapping ────────────────────────────────────────────────────

const toneClasses: Record<string, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  accent: "text-accent",
  danger: "text-destructive",
};

// ── Spark Renderer (tiny inline chart) ──────────────────────────────

function renderSparkline(trend: number): React.ReactNode {
  const positive = trend > 0;
  const Icon = positive ? TrendingUp : Activity;
  const color = positive ? "text-green-600" : "text-red-600";

  return (
    <div className="flex items-center gap-1">
      <Icon className={`h-3 w-3 ${color}`} />
      <span className={`text-xs font-semibold ${color}`}>
        {positive ? "+" : ""}{trend}%
      </span>
    </div>
  );
}

// ── Node Renderer ────────────────────────────────────────────────────

export function renderDslNode(
  node: DslNode,
  key: string | number = 0,
  ctx: RenderCtx = {}
): React.ReactNode {
  const { depth = 0, maxDepth = 12, diagnosticCount = 0 } = ctx;

  // Guard: max recursion depth
  if (depth > maxDepth) {
    return (
      <div key={key} className="text-xs text-red-600">
        ⚠ Nesting too deep (max {maxDepth})
      </div>
    );
  }

  // Guard: too many diagnostics (spec is malformed)
  if (diagnosticCount > 20) {
    return (
      <div key={key} className="text-xs text-red-600">
        ⚠ Spec has {diagnosticCount} errors
      </div>
    );
  }

  switch (node.kind) {
    case "text":
      return (
        <p
          key={key}
          className={`text-sm ${toneClasses[node.tone ?? "default"]}`}
        >
          {node.value}
        </p>
      );

    case "value":
      const formattedValue =
        node.format === "percent"
          ? `${node.value}%`
          : node.format === "bytes"
            ? `${node.value} B`
            : node.format === "duration_ms"
              ? `${node.value}ms`
              : String(node.value);

      return (
        <div key={key} className="text-lg font-semibold font-mono">
          {formattedValue}
        </div>
      );

    case "spark":
      return (
        <div key={key} className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{node.label}</span>
          {renderSparkline(node.trend)}
        </div>
      );

    case "chip":
      const intentClasses: Record<string, string> = {
        info: "bg-blue-100 text-blue-900",
        warn: "bg-yellow-100 text-yellow-900",
        ok: "bg-green-100 text-green-900",
        danger: "bg-red-100 text-red-900",
      };
      return (
        <span
          key={key}
          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
            intentClasses[node.intent ?? "info"]
          }`}
        >
          {node.label}
        </span>
      );

    case "action":
      return (
        <button
          key={key}
          disabled={node.disabled}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            node.disabled
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {node.label}
        </button>
      );

    case "panel":
      return (
        <div
          key={key}
          className="border border-border rounded-lg bg-card p-3 space-y-2"
        >
          {node.title && (
            <h3 className="text-sm font-semibold">{node.title}</h3>
          )}
          <div className="space-y-2">
            {node.children?.map((child, i) =>
              renderDslNode(child, `${key}-child-${i}`, {
                ...ctx,
                depth: depth + 1,
              })
            )}
          </div>
        </div>
      );

    case "stack":
      const gaps: Record<number | undefined, string> = {
        0: "gap-0",
        2: "gap-1",
        4: "gap-2",
        8: "gap-4",
        16: "gap-6",
      };
      const flexDir = node.axis === "row" ? "flex-row" : "flex-col";
      const gapClass = gaps[node.gap] ?? "gap-2";

      return (
        <div key={key} className={`flex ${flexDir} ${gapClass}`}>
          {node.children?.map((child, i) =>
            renderDslNode(child, `${key}-stack-${i}`, {
              ...ctx,
              depth: depth + 1,
            })
          )}
        </div>
      );

    case "grid":
      return (
        <div
          key={key}
          className={`grid gap-2 grid-cols-${node.cols}`}
          style={{
            gridTemplateColumns: `repeat(${node.cols}, minmax(0, 1fr))`,
          }}
        >
          {node.children?.map((child, i) =>
            renderDslNode(child, `${key}-grid-${i}`, {
              ...ctx,
              depth: depth + 1,
            })
          )}
        </div>
      );

    case "list":
      return (
        <ul key={key} className="space-y-1">
          {node.items?.map((item, i) => (
            <li key={`${key}-item-${i}`} className="text-xs text-muted-foreground">
              • {item}
            </li>
          ))}
        </ul>
      );

    case "when":
      return node.condition
        ? renderDslNode(node.then, `${key}-then`, {
            ...ctx,
            depth: depth + 1,
          })
        : node.else
          ? renderDslNode(node.else, `${key}-else`, {
              ...ctx,
              depth: depth + 1,
            })
          : null;

    case "diagnostic":
      return (
        <div
          key={key}
          className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md"
        >
          <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-yellow-700">{node.reason}</span>
        </div>
      );

    default:
      const unknownNode = node as { kind: string };
      return (
        <div key={key} className="text-xs text-red-600">
          ⚠ Unknown node kind: {unknownNode.kind}
        </div>
      );
  }
}

// ── Validator ────────────────────────────────────────────────────────

export function validateDslSpec(node: DslNode): string[] {
  const errors: string[] = [];
  let nodeCount = 0;

  function walk(n: DslNode) {
    nodeCount++;
    if (nodeCount > 200) {
      errors.push("Spec exceeds 200-node limit");
      return;
    }

    if ("children" in n && Array.isArray(n.children)) {
      n.children.forEach(walk);
    }

    if ("items" in n && Array.isArray(n.items)) {
      // list items are data, not recursive nodes
    }
  }

  walk(node);
  return errors;
}

// ── Unsafe Patterns Check ────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  "__html",
  "__dangerously",
  "eval",
  "new Function",
  "fetch",
  "XMLHttpRequest",
  "import.meta",
  "globalThis",
];

export function checkForbiddenPatterns(spec: unknown): string[] {
  const specStr = JSON.stringify(spec);
  return FORBIDDEN_PATTERNS.filter((pattern) =>
    specStr.toLowerCase().includes(pattern.toLowerCase())
  ).map((p) => `Forbidden pattern detected: ${p}`);
}
