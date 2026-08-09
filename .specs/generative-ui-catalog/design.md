# Design — Generative UI Catalog

## 1. Architecture

```text
 gemma_brain ──mint──▶ CatalogService (gRPC) ──stream──▶ op-web (Rust) ──gRPC-Web──▶ React SPA
                              │                                                          │
                              ▼                                                          ▼
                       catalog store                                              useCatalogStore
                       (authoritative)                                            (Zustand projection)
                                                                                         │
                                                                                         ▼
                                                                                  DSL Interpreter
                                                                                  (json-render.dev)
                                                                                         │
                                                                                         ▼
                                                                                  Shadcn primitives
```

Authoritative state lives in gemma_brain. The frontend is a projection. The interpreter is the only renderer.

## 2. Components

### 2.1 CatalogService (gRPC)
```protobuf
service CatalogService {
  rpc Subscribe(SubscribeRequest) returns (stream CatalogFrame);
  rpc Ack(AckRequest) returns (AckResponse);
}

message SubscribeRequest { string session_id = 1; optional uint64 resume_cursor = 2; }

message CatalogFrame {
  uint64 cursor = 1;
  oneof body {
    Snapshot snapshot = 2;
    Upsert   upsert   = 3;
    Evict    evict    = 4;
    Heartbeat heartbeat = 5;
  }
}

message Element {
  string id = 1;          // content-addressed
  bytes  spec = 2;        // DSL JSON, gzipped
  ElementMeta meta = 3;
}

message ElementMeta {
  string constraint_cocktail_hash = 1;
  uint64 minted_at_ms = 2;
  repeated string forbidden_names_checked = 3; // audit trail
  uint32 dsl_node_count = 4;
}
```

Framing follows the project's custom 5-byte length-prefixed gRPC-Web convention (`mem://tech/communication-protocol`). Routed via Nginx on internal ports 50051/50052 (`mem://tech/grpc-network-routing`).

### 2.2 Catalog store (Rust, op-web)
- Holds the rolling 200-element window.
- Validates incoming `Upsert` against DSL schema; rejected elements never reach the client.
- Enforces the no-name rule by scanning `ElementMeta` and spec strings against the forbidden-names lexicon derived from `mem://features/generative-ui/inspiration-primitives`.
- Persists cursor per session for resume.

### 2.3 useCatalogStore (Zustand)
```ts
interface CatalogState {
  byId: Map<string, Element>;
  order: string[];               // freshness-ordered
  cursor: bigint;
  applyFrame(frame: CatalogFrame): void;  // imperative, no setState in hot path
  get(id: string): Element | undefined;
}
```
- High-frequency `applyFrame` writes through `getState()` to avoid re-renders (`mem://tech/high-frequency-stream-performance`).
- A separate `useCatalogVersion()` selector exposes a monotonic version for components that must subscribe.

### 2.4 DSL Interpreter
- Pure function: `(spec: DslNode, ctx: RenderCtx) => ReactNode`.
- `RenderCtx` provides: masked data accessors, action dispatcher, theme tokens, diagnostics sink.
- Node kinds map to Shadcn primitives (`mem://features/generative-ui`).
- Unknown nodes render a `<DslDiagnostic>` chip with the node kind and element id — never throw.

### 2.5 Mint pipeline (gemma_brain side, summarized)
- For each mint request, build the prompt from the constraint-cocktail scaffold.
- Strip / regenerate on any forbidden-name hit.
- Output validated against DSL JSON schema before publishing to CatalogService.

## 3. Data flow per render

1. Surface declares a `surfaceKey`.
2. Resolver picks an element id from the catalog by `surfaceKey` affinity (round-robin within compatible set).
3. Interpreter renders the spec with a `RenderCtx` bound to that surface.
4. Operator interaction dispatches DSL actions → `useEventStore` → backend mutations.

## 4. Failure modes

| Failure | Behavior |
|---|---|
| Stream disconnect | Reconnect with last cursor; UI keeps last good elements. |
| Empty catalog | Render "awaiting mint" diagnostic surface. |
| Spec validation fail at backend | Element never enters store; logged to reasoning-audit. |
| Unknown DSL node at runtime | Inline diagnostic chip, surrounding spec keeps rendering. |
| Forbidden-name hit | Element rejected pre-publish; gemma re-prompted with stricter constraints. |

## 5. Security

- Masking enforced inside `RenderCtx` accessors — specs cannot bypass.
- DSL has no escape hatch: no raw HTML node, no script node, no fetch node.
- All mutations dispatched through the existing action allowlist.

## 6. Trade-offs accepted

- **Variety over consistency:** operator sees different elements per session. Mitigated by surface-affinity resolver.
- **Interpreter overhead vs. compile-time components:** accepted for zero-deploy iteration.
- **gemma authorship vs. determinism:** accepted; reasoning-audit captures provenance.
