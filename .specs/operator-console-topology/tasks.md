# Tasks — Operator Console Topology

Ordered. Each task ships independently behind a feature flag until the cutover task flips defaults.

## Native shell hardening

- [ ] **T-1** Inventory `zeroclaw-gui` modules (`main`, `app`, `nav`, `theme`, `grpc`, `schema`, `views/*`) and pin module boundaries. Document in `zeroclaw-gui/README.md`.
- [ ] **T-2** Bootstrap perf gate: cold-start to first frame < 500ms; reflection load < 1s on LAN.
- [ ] **T-3** Add virtualization to `schema::render_array` for ≥10k-node payloads. Strategy: `egui::ScrollArea::show_rows` for visible-slice rendering; `ExplorerState` expanded-rows cache flattens tree into `Vec<RowHandle>` per frame; `ctx.request_repaint()` only on scroll/stream events, not per frame. See design.md §4.1.
- [ ] **T-4** Discriminator-aware `oneOf` branch picker in `schema.rs`.
- [ ] **T-5** `$ref` resolution in `schema.rs` (intra-pool first; external as labeled diagnostic).
- [ ] **T-6** Wire `localOverrides` (`mem://features/state/tunable-edit-pattern`) into `schema::render_leaf` for editable nodes.

## SPA strip from `op-web`

- [ ] **T-7** Delete `op-web::handlers::gemma`, `op-web::handlers::ui_gallery`, `/api/gemma/*` routes, rust-embed of Vite `dist/`.
- [ ] **T-8** CI gate: reject PRs that reintroduce SPA-only handlers or embed of `dist/`.
- [ ] **T-9** Re-baseline `op-web` binary size; record in `op-web/PERF.md`.

## React workspace demotion

- [ ] **T-10** Add repo-root README section stating the two-system split.
- [ ] **T-11** Tag every `lovable/src` route as "design-only" in nav metadata; remove any business-logic-only routes.
- [ ] **T-12** Disable `lovable/` production publish target; keep Vite preview for design iteration.

## ChatService (server)

- [ ] **T-Chat-0** Gather conversation shape (threaded vs. single) via `questions--ask_questions`. Storage is settled: memory loop + cognitive-mcp (no Supabase, no localStorage). Block all subsequent chat tasks on the shape answer.
- [ ] **T-Chat-1** Add `chat.proto` (`ChatService.Send/Approve/Cancel`, `ChatFrame`, `UIMessagePart`). `SendRequest` carries `provider` / `model` fields from zeroclaw's routing selection. Wire into protoc build.
- [ ] **T-Chat-2** Implement `ChatService` in `op-web` as a thin gRPC façade. `gemma_brain` routes to the interchangeable model backend (selected by zeroclaw) and applies compliance tags. Encode model parts directly into `ChatFrame` over the project 5-byte framing. **No AI SDK provider, no `streamText`, no `LOVABLE_API_KEY`.**
- [ ] **T-Chat-3** Tool registry in Rust: wrap selected `op-plugins` RPCs with `schemars` input schemas; mark mutating tools as approval-required.
- [ ] **T-Chat-4** Agent loop bounded ≥50 steps; cancellable via `ChatService.Cancel`; surface inference unavailable / overloaded errors explicitly. `gemma_brain` may fall back to alternate model if configured.
- [ ] **T-Chat-5** Persona-driven system prompt + tool catalog sourced from `gemma_brain`'s persona registry stream.
- [ ] **T-Chat-6** Chat persistence via memory loop + cognitive-mcp: feed completed transcripts as `evt.*` records into the memory loop; recall by semantic search through cognitive-mcp's Qdrant-backed memory tools. No Supabase, no localStorage, no XDG JSON files.

## Lovable AI disconnection

- [ ] **T-Disco-1** Disconnect the Lovable AI Gateway at the project level (operator action; document in README).
- [ ] **T-Disco-2** Delete any `src/lib/ai-gateway*`, `supabase/functions/chat`, `@ai-sdk/openai-compatible` provider helpers, and any `/api/chat` route pointing at `ai.gateway.lovable.dev`.
- [ ] **T-Disco-3** Remove `LOVABLE_API_KEY` from project secrets and from any code path that reads it.
- [ ] **T-Disco-4** Add CI gate rejecting reintroduction of: `ai.gateway.lovable.dev`, `Lovable-API-Key`, `LOVABLE_API_KEY`, `createLovableAiGatewayProvider`, `@ai-sdk/openai-compatible`.
- [ ] **T-Disco-5** README states explicitly: gemma is local-only; other models may be remote providers routed by `gemma_brain` per zeroclaw's selection; LLM routing owned by zeroclaw; Lovable AI Gateway is not used.

## LLM routing consolidation (OD-28)

- [ ] **T-Route-1** Move LLM provider/model routing from `op-llm` crate to zeroclaw. Consolidate `switch_provider` / `switch_model` / `/api/llm/*` endpoints into zeroclaw's `selected_provider` / `selected_model` state.
- [ ] **T-Route-2** Remove `op-llm` runtime switching code (`LlmProvider` trait dispatch, `ProviderType` enum, `/api/llm/*` routes). Provider impls that zeroclaw needs are moved or wrapped as zeroclaw plugins.
- [ ] **T-Route-3** `SendRequest` in `chat.proto` carries `provider` / `model` from zeroclaw; `op-web` ChatService passes them through to `gemma_brain` for routing. Server does not make routing decisions.
- [ ] **T-Route-4** `gemma_brain` applies compliance tags and subid classification to chat frames; it consumes the `large_language_model` plugin for projections but does not select the model.
- [ ] **T-Route-5** CI gate: reject reintroduction of `op-llm` runtime switching or `/api/llm/*` routes.

## Native chat panel (`zeroclaw-gui/src/chat/`)

- [ ] **T-Chat-7** `chat::transport` — subscribe to `ChatService.Send`, decode `ChatFrame` → `UIMessagePart`.
- [ ] **T-Chat-8** `chat::store` — append-only conversation store, imperative writes (no per-token repaint storm).
- [ ] **T-Chat-9** `chat::view::transcript` with sticky-to-bottom + scroll affordance.
- [ ] **T-Chat-10** `chat::view::message` — role-styled, markdown rendering for assistant; high-contrast bubble for user.
- [ ] **T-Chat-11** `chat::view::tool_card` — collapsed-by-default input, compact output, domain icon, status indicator (collapsed in completed/error too).
- [ ] **T-Chat-12** `chat::view::composer` — persistent focus, `Thinking…` indicator, status-aware submit, never stretches.
- [ ] **T-Chat-13** Approval flow: render approval prompt inline for approval-required tool calls; round-trip via `ChatService.Approve`.
- [ ] **T-Chat-14** Identity glyph: domain-specific operator console mark — assert no `Sparkles` import, not tied to any specific model.
- [ ] **T-Chat-15** Add `Route::Chat` (with `thread_id` when shape = threaded) to `nav.rs`; restore on launch.

## Observability & audit

- [ ] **T-Chat-20** Log every `ChatFrame` cursor + tool call/result hash into the reasoning-audit pipeline.
- [ ] **T-Chat-21** Per-tool latency + approval outcome counters in management dashboards.
- [ ] **T-Chat-22** gRPC-Web diagnostics surface includes ChatService stream health.

## Cutover

- [ ] **T-23** Flip `Chat` route to default landing surface in `zeroclaw-gui` (behind operator preference).
- [ ] **T-24** Remove the last SPA-only references; close the two-system split README section to "operator runtime = native; React = design workspace (no chat); gemma local-only, other models may be remote; LLM routing owned by zeroclaw; Lovable AI Gateway not used".

## Performance gates

- [ ] **T-P1** Chat token stream p50 first-token < 150ms on the operator LAN for gemma (local). Remote provider latency depends on provider.
- [ ] **T-P2** Schema renderer sustains 60fps on a 10k-node payload with virtualization.
- [ ] **T-P3** High-frequency SSE/WS stream applied with zero unrelated repaint in egui (imperative store path).

## Open decisions before T-Chat-1

- Conversation shape (threaded vs single).
- Whether destructive tools require approval by default (recommend yes).
