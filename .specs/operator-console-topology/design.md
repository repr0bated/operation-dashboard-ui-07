# Design — Operator Console Topology

## 1. Topology

```text
                    Operator workstation
        ┌───────────────────────────────────────────┐
        │   zeroclaw-gui  (native eframe/egui)      │
        │   - tokio runtime                         │
        │   - tonic-web gRPC client                 │
        │   - prost-reflect DescriptorPool          │
        │   - schemars-driven UI renderer           │
        │   - embedded Chat panel (routed model)     │
        │   - LLM provider/model routing authority   │
        └───────────────┬───────────────────────────┘
                        │ gRPC-Web (HTTP/1.1, 5-byte framing)
                        │ + ServerReflection bootstrap
                        ▼
        ┌───────────────────────────────────────────┐
        │   nginx reverse proxy                     │
        │   :50051 / :50052 → op-web                │
        └───────────────┬───────────────────────────┘
                        ▼
        ┌───────────────────────────────────────────┐
        │   op-web (Rust, tonic + tower)            │
        │   - tonic-web GrpcWebLayer                │
        │   - tonic_reflection                      │
        │   - op-plugins services                   │
        │   - SSE/WS sidecar (high-freq state)      │
        │   - ChatService (routing + tool dispatch)  │
        └───────┬─────────────┬─────────────────────┘
                │             │
                ▼             ▼
         D-Bus mirror     gemma_brain
         (1:1 truth)      (routing, compliance
                          tags, projections:
                          gallery, reasoning,
                          persona registry)
                │
                ▼
        ┌───────────────────────────────────────────┐
        │ Backplane                                 │
        │  Qdrant @ 10.149.181.190:6334             │
        │  Blockchain audit · Embedding worker      │
        │  s6/s6-rc supervision (Artix)             │
        │  WireGuard / XRay / WARP mesh             │
        │  Identity sled (WG pubkey → RBAC)         │
        └───────────────────────────────────────────┘
```

## 2. Two-system split

| Surface | Role | Runtime |
|---|---|---|
| `lovable/` | Design workspace: theme, nav, widget prototyping (no chat) | React 18 + Vite + Tailwind |
| `lovable/.zeroclaw/` | Operator runtime (`zeroclaw-gui`) | Rust + eframe/egui + tokio |

The React workspace exists to iterate visuals and schema-driven widgets quickly. It is not the product. The `op-web` SPA handlers and rust-embed of Vite `dist/` are removed in this spec.

## 3. `zeroclaw-gui` elements

| File | Role |
|---|---|
| `main.rs` | eframe entry, tokio multi-thread runtime, `grpc::bootstrap` against `ZEROCLAW_GRPC` |
| `app.rs` | Shell: topbar + collapsible sidebar + routed content; holds `ReflectionRegistry`, `InvokeHandle`, `ExplorerState`, theme, connection |
| `nav.rs` | `Route` enum + `NAV_GROUPS`, mirrors the React nav 1:1 |
| `theme.rs` | Graphite/slate dark tokens, red accents, Space Grotesk / JetBrains Mono |
| `grpc.rs` | tonic-web `Channel`, `ServerReflectionClient`, `DescriptorPool`, `decode_to_json` |
| `schema.rs` | `(schemars::Schema, serde_json::Value) → egui` recursive renderer |
| `views/` | Schema-driven views: Inspector, State, gRPC, gRPC Explorer, Logs, etc. |
| `chat/` | New module — Antigravity IDE interface (JSON-rendered, Antigravity SDK baked in) + LLM provider/model routing (OD-28) (see §5) |

## 4. Technologies & protocols

**Native client:** eframe 0.28, egui 0.28, tokio, hyper 1, http, tower, tonic 0.12, tonic-web 0.12, tonic-reflection 0.12, prost 0.13, prost-reflect 0.14, serde, schemars 1.0, release profile with thin LTO.

**Backplane:** Qdrant, blockchain audit, embedding worker, s6/s6-rc on Artix, WireGuard/XRay/WARP, identity sled (WG-pubkey → RBAC), D-Bus mirror. **No Supabase at runtime** — Lovable Cloud is provisioned but unused; no tables, auth, edge functions, or storage are reached from app code.

**Protocols:**
- gRPC-Web over HTTP/1.1 with custom 5-byte length-prefixed framing (`mem://tech/communication-protocol`).
- gRPC ServerReflection v1.
- Schema-as-code (`schemars`) contract for payload shape.
- Hybrid unary/server-stream + SSE/WS sidecar for high-frequency state (`mem://features/streaming`).
- D-Bus mirror for 1:1 host-state sync (`mem://tech/grpc-dbus-mirror-architecture`).

### 4.1 egui virtualization strategy

egui is immediate-mode; virtualization is done by rendering only the visible row range, not by offscreen DOM nodes.

- `schema::render_array` uses `egui::ScrollArea::show_rows(height, |range| { ... })` to iterate only the visible slice of large arrays. The row height is computed from the first N items and cached; heterogeneous heights fall back to a fixed estimate with a correction pass.
- For tree-structured payloads (`object` with nested `properties`), an expanded-rows cache (`ExplorerState`) flattens the visible tree into a `Vec<RowHandle>` per frame. Only the visible range of that vector is rendered.
- `ctx.request_repaint()` is called only on scroll events and stream updates, not on every frame. Idle surfaces do not request repaint.
- The `RowHandle` indirection means schema resolution + data lookup happens for visible rows only; a 10k-node payload with 50 visible rows does O(50) work per frame, not O(10k).

## 5. Embedded Chat (Antigravity IDE interface)

The chat panel lives **inside** `zeroclaw-gui` as the `Chat` route. It is the actual Antigravity IDE interface — JSON-rendered via the json-render DSL (`generative-ui-catalog` spec) with the Antigravity SDK baked in. It is not a reimplementation or a lookalike; it is the real interface, rendered through the DSL interpreter.

**LLM routing authority:** `zeroclaw` owns LLM provider/model routing (OD-28). The `zeroclaw` plugin carries `selected_provider` / `selected_model` and is the single routing authority. The `op-llm` crate's runtime switching (`switch_provider` / `switch_model` via `/api/llm/*`) is removed and consolidated under zeroclaw. `gemma_brain` handles routing-compliance, subid classification, 4-perspectives, and gallery projections; it consumes the `large_language_model` plugin (model-agnostic, model is a swappable field) but does not own provider selection. The chatbot model is interchangeable — gemma is just one model in this model-agnostic stack.

**Hosting:** only gemma is local-only. Other models in the interchangeable stack may be remote providers (e.g. Anthropic, OpenAI), routed by `gemma_brain` per zeroclaw's selection. **Lovable AI Gateway is not used.** No `LOVABLE_API_KEY`, no `ai.gateway.lovable.dev`.

### 5.1 Server side (`op-web` ChatService)

- New gRPC service `ChatService` with:
  - `Send(SendRequest) returns (stream ChatFrame)` — streams `UIMessagePart` events as binary-framed gRPC-Web frames.
- **Routing is zeroclaw's authority.** `SendRequest` carries the provider/model selection from zeroclaw's `selected_provider` / `selected_model` state. `op-web` is the gRPC façade and tool dispatcher; it does not own provider switching. The `op-llm` crate's `switch_provider` / `switch_model` / `/api/llm/*` endpoints are removed.
- `gemma_brain` applies compliance tags and subid classification to chat frames; it does not select the model. It consumes the `large_language_model` plugin for cognitive projections (gallery, reasoning, 4-perspectives).
- Tool catalog defined in Rust (typed argument schemas via `schemars`), each tool wraps an existing `op-plugins` RPC.
- Mutating tools require explicit approval; approval round-trips through the chat panel via `ChatService.Approve`.
- Agent loop is bounded (≥50 steps) and cancellable via `ChatService.Cancel`.
- System prompt, tool catalog, and persona come from `gemma_brain`'s persona registry stream.
- The wire shape mirrors the AI SDK `UIMessage` part vocabulary (text / tool-call / tool-result / reasoning) so renderers stay portable, but the producer is our own runtime — no AI SDK `streamText` / `toUIMessageStreamResponse` call exists on the server.

### 5.2 Native client side (`zeroclaw-gui/src/chat/`)

- `chat::transport` — subscribes to `ChatService.Send`, decodes `ChatFrame` → `UIMessagePart`, pushes into `chat::store`.
- `chat::store` — append-only `Vec<UIMessage>` keyed by conversation id; imperative writes to avoid egui repaint storms on token bursts. `ctx.request_repaint()` is called on a throttle (e.g. every 16ms ≈ 60fps cap), not per-token, so token bursts coalesce into single repaints.
- `chat::view` — egui composition mapping the Antigravity SDK components through the json-render DSL interpreter (renderer parity, not transport parity):
  - Conversation transcript with sticky-to-bottom + scroll affordance.
  - Per-message role styling: assistant text on the page surface (no bubble); user messages in a high-contrast token pair.
  - Streamed markdown for assistant text.
  - Tool parts: name + status + domain icon, input collapsed by default, compact output.
  - Composer: persistent focus, "Thinking…" indicator during `submitted`.
  - Identity: domain-specific glyph for the operator console, not tied to any specific model or `Sparkles`.

### 5.3 Conversation/storage

Conversation persistence is handled by the **memory loop** (`mem://features/memory-loop`) backed by **cognitive-mcp** (`100.90.37.254:3003`). No Supabase, no browser localStorage, no XDG JSON files.

- **Memory loop** owns the conversation lifecycle: append, recall, summarization, eviction. Chat transcripts are fed into the loop as `evt.*` records and recalled by semantic search through cognitive-mcp's Qdrant-backed memory tools.
- **cognitive-mcp** is the persistence gateway. The native client never writes chat state to disk directly; it dispatches memory-store actions through the existing gRPC → D-Bus → cognitive-mcp path.
- Conversation shape (threaded vs. single) is still gathered via `questions--ask_questions` before implementation, but storage is settled: memory loop + cognitive-mcp, always.
- If threaded, `thread_id` is a cognitive-mcp memory key, not a database row ID. Native route is `Route::Chat(thread_id)` in `nav.rs`.

### 5.4 Lovable AI disconnection and op-llm removal

- Project-level Lovable AI Gateway is disconnected; `LOVABLE_API_KEY` is removed from project secrets.
- Any pre-existing `src/lib/ai-gateway*`, `supabase/functions/chat`, or `@ai-sdk/openai-compatible` provider code is deleted.
- `op-llm` runtime switching (`switch_provider` / `switch_model` / `/api/llm/*`) is removed; LLM routing consolidated under zeroclaw (OD-28).
- The repo README states explicitly: **gemma is local-only; other models may be remote providers routed by `gemma_brain` per zeroclaw's selection; LLM routing owned by zeroclaw; Lovable AI Gateway is not used.**

## 6. Failure modes

| Failure | Behavior |
|---|---|
| gRPC bootstrap fails | Console renders connection diagnostic surface; retries with backoff. |
| Reflection missing a descriptor | Affected view shows labeled diagnostic; other views unaffected. |
| Chat stream disconnect | Last good transcript preserved; retry with cursor; UI shows reconnecting state. |
| Tool error | Inline tool card flips to error state with compact error payload; transcript continues. |
| Chat model unavailable / overloaded | ChatService returns explicit error frame; UI surfaces actionable status (queue depth, retry hint). `gemma_brain` routing layer may fall back to alternate model if configured. |
| Masking violation attempt | Accessor refuses; reasoning-audit records attempt. |

## 7. Security

- **Identity** = caller's WireGuard public key, stored in the identity sled inside the Rust stack (`mem://auth/wireguard-identity`). No JWT, no Supabase auth, no OAuth, no bearer tokens on the wire.
- **Authorization** = RBAC lookup against the identity sled, enforced server-side in `op-web`.
- Chat tools execute server-side only; client cannot invoke arbitrary RPCs through chat.
- Approval-gated tools require explicit operator confirmation in the chat UI.
- All chat tool calls + results recorded in the blockchain audit pipeline (`mem://features/security/audit-and-search`).
- Gemma model traffic stays on the operator network. Remote provider traffic (when selected by zeroclaw) egresses through the established WireGuard/XRay mesh — never through the Lovable AI Gateway.
- **No Supabase at runtime** (`mem://constraints/no-supabase-runtime-use`): no `public` tables, RLS policies, edge functions, or storage buckets are read or written by the application.

## 8. Trade-offs accepted

- **Native-only runtime** vs. browser convenience — accepted; operator workflow demands it.
- **Interchangeable models with local-first gemma** vs. managed AI gateway — accepted. Only gemma is local-only for data sovereignty and offline operation; other models may be remote providers routed by `gemma_brain` per zeroclaw's selection. We give up the AI SDK ecosystem (`streamText`, provider switching) but keep its `UIMessage` wire vocabulary so renderers stay portable.
- **Two design surfaces (React + egui)** vs. one — accepted as design workspace cost; offset by shared schema/DSL contracts.
