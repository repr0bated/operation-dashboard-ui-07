# Tasks — Generative UI Catalog

Ordered. Each task is independently shippable behind a feature flag until T-12 flips the default.

## Backend (op-web, Rust)

- [ ] **T-1** Define `catalog.proto` (`CatalogService`, `CatalogFrame`, `Element`, `ElementMeta`). Wire into existing protoc build.
- [ ] **T-2** Implement in-memory rolling 200-element store with cursor, FIFO eviction stub. Unit tests for insert / evict / resume.
- [ ] **T-3** Implement DSL JSON schema validator. Reject specs that violate invariants or exceed 200 nodes.
- [ ] **T-4** Implement forbidden-names lexicon loader from `mem://features/generative-ui/inspiration-primitives`. Reject specs/metadata on hit.
- [ ] **T-5** Implement `Subscribe` server-stream with `Snapshot` → `Upsert`/`Evict` → `Heartbeat` loop. Resume-by-cursor path.
- [ ] **T-6** Wire CatalogService into Nginx routing (ports 50051/50052) per `mem://tech/grpc-network-routing`.

## gemma_brain integration

- [ ] **T-7** Implement mint-prompt scaffold builder from `mem://features/generative-ui/mint-prompt-scaffold`. Property-test that no forbidden names leak into prompts.
- [ ] **T-8** Publish-to-CatalogService pipeline with rejection feedback loop (re-prompt with stricter constraints on rejection).

## Frontend (React/TS SPA)

- [ ] **T-9** `useCatalogStore` (Zustand) with imperative `applyFrame` via `getState()`. Version selector for subscribers.
- [ ] **T-10** gRPC-Web client for `CatalogService.Subscribe`. Reconnect-with-cursor. Heartbeat watchdog (12s).
- [ ] **T-11** DSL interpreter: pure render function, node kind dispatch, `<DslDiagnostic>` fallback. Snapshot tests per node kind.
- [ ] **T-12** Surface resolver: `useCatalogElement(surfaceKey)` with round-robin within compatible set.
- [ ] **T-13** `RenderCtx` implementation: masked accessor, allowlisted dispatcher, semantic theme tokens, diagnostics sink.
- [ ] **T-14** Empty-catalog "awaiting mint" diagnostic surface.

## Migration / cleanup

- [ ] **T-15** Inventory current hand-rolled renderers. Map each to a `surfaceKey`.
- [ ] **T-16** Route each surface through `useCatalogElement` + interpreter behind flag `catalog.v1`.
- [ ] **T-17** Delete hand-rolled renderers and inline DSL literals. `rg` gate in CI: no DSL literals outside `__fixtures__/`.
- [ ] **T-18** Flip `catalog.v1` default to on.

## Observability & audit

- [ ] **T-19** Log applied frames (cursor + element ids) to reasoning-audit pipeline (`mem://features/accountability/reasoning-audit`).
- [ ] **T-20** Per-element diagnostic counter; surface in management dashboard.
- [ ] **T-21** Expose mint provenance (`ElementMeta`) in reasoning-audit detail view.

## Performance gates

- [ ] **T-22** Benchmark: 200-node spec renders in <16ms on operator workstation.
- [ ] **T-23** Benchmark: 50 frames/sec stream applied with zero React re-render in non-subscribed components.

## Open decisions before T-2 / T-5

- Eviction policy: FIFO vs. weighted (block on product decision).
- Snapshot diffability (block on T-5 implementation choice).
- Mint provenance exposure in audit (block on T-21).
