# Spec — Generative UI Catalog (interface contract)

## 1. DSL schema (json-render.dev subset)

```ts
type DslNode =
  | { kind: "stack"; axis: "row" | "col"; gap?: number; children: DslNode[] }
  | { kind: "grid"; cols: number; gap?: number; children: DslNode[] }
  | { kind: "text"; value: string | DataRef; tone?: "default" | "muted" | "accent" | "danger" }
  | { kind: "value"; ref: DataRef; format?: ValueFormat }
  | { kind: "spark"; ref: DataRef; window: number }
  | { kind: "chip"; label: string | DataRef; intent?: "info" | "warn" | "ok" | "danger" }
  | { kind: "action"; label: string; dispatch: ActionRef; confirm?: ConfirmSpec }
  | { kind: "panel"; title?: string; children: DslNode[] }
  | { kind: "list"; ref: DataRef; item: DslNode; key: string }
  | { kind: "when"; ref: DataRef; eq?: unknown; lt?: number; gt?: number; then: DslNode; else?: DslNode }
  | { kind: "diagnostic"; reason: string };

type DataRef   = { path: string; mask?: "default" | "explicit" };
type ActionRef = { name: string; args?: Record<string, DataRef | Literal> };
type ValueFormat = "number" | "bytes" | "duration_ms" | "iso8601" | "percent";
type ConfirmSpec = { mode: "hold" | "drag" | "chord"; ms?: number };
```

**Invariants**
- No `kind: "html"`, no `kind: "script"`, no `kind: "fetch"`.
- `DataRef.path` is resolved against the masked accessor; raw access is impossible.
- `ActionRef.name` must be in the action allowlist or the node renders as `diagnostic`.

## 2. gRPC contract

See `design.md` §2.1. Wire format: project-standard 5-byte length-prefixed gRPC-Web.

**Frame ordering guarantee:** monotonically increasing `cursor`. Client treats out-of-order frames as a protocol error and reconnects.

**Heartbeat:** server emits at ≤5s interval. Client treats >12s silence as disconnect.

## 3. Mint request contract (gemma_brain internal)

Conforms to `mem://features/generative-ui/mint-prompt-scaffold`:

```text
CONTEXT: <one sentence operator scenario>
DATA SHAPE: <abstract, no UI nouns>
SIGNAL TO CONVEY: <what operator must know after looking>
ACTION TO AFFORD: <what operator must be able to do>
CONSTRAINTS: <3–5 hard constraints, ≥1 forbidden behavior>
TRADE-OFF VECTOR: <optimize X, sacrifice Y>
FORBIDDEN: any named UI pattern, any element resembling existing gallery entry
OUTPUT: json-render.dev DSL only
```

**Rejection rules:**
- Element metadata or spec strings containing tokens from the forbidden-names lexicon → reject, re-prompt with stricter constraints.
- Spec failing DSL schema → reject.
- Spec exceeding 200 nodes → reject.

## 4. Frontend surface contract

```ts
function useCatalogElement(surfaceKey: string): Element | undefined;
function renderElement(el: Element, ctx: RenderCtx): ReactNode;

interface RenderCtx {
  data: MaskedAccessor;       // honors mem://features/security-masking
  dispatch: ActionDispatcher; // allowlisted
  theme: ThemeTokens;         // semantic tokens only
  diagnostic: (msg: string) => void;
}
```

No component outside the interpreter constructs DSL nodes at runtime.

## 5. Observability

- Every applied frame logged with cursor + element ids to reasoning-audit.
- Interpreter diagnostics counted per element id; elements with high diagnostic rates are eligible for eviction.
- gRPC-Web diagnostics surface in the existing diagnostics panel (`mem://features/grpc-diagnostics`).
