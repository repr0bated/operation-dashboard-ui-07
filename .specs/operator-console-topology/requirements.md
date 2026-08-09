# Requirements — Operator Console Topology

**Feature:** Native `zeroclaw-gui` operator console as the sole runtime, with `lovable/` React SPA demoted to a design workspace, and an embedded Antigravity IDE interface (JSON-rendered, Antigravity SDK baked in) as the primary operator-to-system interface. LLM provider/model routing is owned by zeroclaw (OD-28). Only gemma is local-only; other models may be remote providers. No Lovable AI Gateway, no Supabase.

**Status:** Draft
**Owner:** AI Agent (authoritative)
**Related memory:** `mem://tech/architecture`, `mem://tech/communication-protocol`, `mem://tech/grpc-dbus-mirror-architecture`, `mem://tech/grpc-network-routing`, `mem://tech/state-projection-store`, `mem://features/streaming`, `mem://features/grpc-diagnostics`, `mem://features/generative-ui/json-render-catalog`

---

## 1. User stories

### US-1 — Single operator runtime
As an operator, I want one native console (`zeroclaw-gui`) that runs out-of-browser so that I am not subject to browser sandbox limits, tab lifecycle, or JS GC pauses during incident response.

**Acceptance:**
- `zeroclaw-gui` is the only artifact shipped to operator workstations.
- The React SPA is not published as a production surface.
- Vite preview exists for design iteration only and is clearly labeled as such.

### US-2 — React workspace is design-only
As the AI Agent, I want `lovable/` retained as a prototyping sandbox so that views, theme tokens, nav layout, and schema-driven widgets can be iterated quickly before porting to egui.

**Acceptance:**
- `lovable/` contains no production business logic.
- Every component in `lovable/` has a counterpart or design-only marker.
- README at repo root states the two-system split.

### US-3 — gRPC-Web as the only client transport
As the system, I want all client/server traffic over gRPC-Web with binary 5-byte framing so that protocol shape is uniform across native and (legacy) browser clients.

**Acceptance:**
- No REST endpoints in the production path of `op-web`.
- All RPCs are reachable via `ServerReflection`.
- High-frequency streams use the SSE/WS sidecar documented in `mem://features/streaming`.

### US-4 — Schema-as-code contract
As the renderer, I want every payload describable by a `schemars` Schema so that UI rendering is generic and does not require per-message code.

**Acceptance:**
- Every plugin state struct derives `schemars::JsonSchema`.
- `schema.rs` renders any `(Schema, Value)` pair without crashing.
- Unknown schema constructs degrade to a labeled diagnostic frame, never a raw JSON dump outside one.

### US-5 — gemma_brain owns projections and compliance
As the system, I want `gemma_brain` to be the projection owner for gallery, reasoning, persona registry, and compliance tagging so that the client never recomputes derived state.

**Acceptance:**
- No client-side derivation of gallery or persona state.
- `gemma_brain` applies compliance tags and subid classification to chat frames; it does not own LLM provider/model selection (that is zeroclaw's — see US-10).
- `gemma_brain` consumes the `large_language_model` plugin (model-agnostic) for cognitive projections.
- Projections stream through gRPC; `zeroclaw-gui` mirrors into `useEventStore`-equivalent stores.
- D-Bus mirror stays 1:1 with gRPC truth (`mem://tech/grpc-dbus-mirror-architecture`).

### US-6 — Strip SPA-only paths from `op-web`
As the codebase, I want `op-web` free of SPA-only handlers so that the cutover to native-only is real and not a parallel deployment.

**Acceptance:**
- `handlers/gemma.rs`, `handlers/ui_gallery.rs`, `/api/gemma/*`, and rust-embed of Vite `dist/` removed.
- `op-web` binary size drops accordingly.
- CI gate prevents reintroduction of SPA-only routes.

### US-7 — Embedded Antigravity IDE interface
As an operator, I want the Antigravity IDE interface embedded directly into the console — JSON-rendered through the json-render DSL with the Antigravity SDK baked in — so that I can converse with the system, invoke tools, watch streamed tool activity, and stay in one window.

**Acceptance:**
- A dedicated `Chat` route in `nav.rs` opens a persistent panel inside `zeroclaw-gui`.
- The chat surface is the actual Antigravity IDE interface, not a reimplementation. It is JSON-rendered via the json-render DSL interpreter (`generative-ui-catalog` spec) with the Antigravity SDK baked in.
- The chatbot model is interchangeable; `gemma_brain` routes and applies compliance tags but is not the model itself.
- **No Lovable AI Gateway, no `LOVABLE_API_KEY`.** Only gemma is local-only; other models may be remote providers (e.g. Anthropic, OpenAI) routed by `gemma_brain` per zeroclaw's selection.
- Wire format follows the AI SDK `UIMessage` part shape (text, tool-call, tool-result, reasoning) so the renderer stays interchangeable, but the producer is our own runtime, not the AI SDK provider library.
- Tool activity renders inline with status, collapsible input, and compact output (closed by default).
- The composer stays focused by default; submit disabled while `submitted`/`streaming`.
- Conversation shape (threaded vs. single) is chosen via `questions--ask_questions` before implementation. Storage is settled: memory loop + cognitive-mcp (see US-11).
- Assistant identity uses a domain-specific operator console mark — never `Sparkles`, never tied to a specific model.

### US-8 — No hand-rolled chat renderers
As the codebase, I want the chat UI assembled from the Antigravity SDK components rendered through the json-render DSL interpreter so that the experience is consistent and no bespoke primitives exist.

**Acceptance:**
- Native chat in `zeroclaw-gui` maps Antigravity SDK components (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Tool*`, `Shimmer`) through the DSL interpreter to egui primitives.
- No bespoke transcript, tool accordion, or composer outside the DSL interpreter.
- No React workspace chat mirror exists. Chat is native-only.

### US-9 — Disconnect Lovable AI features
As the project, I want Lovable AI / AI Gateway features explicitly disabled so that nothing in the codebase implies external model hosting.

**Acceptance:**
- `LOVABLE_API_KEY` is not referenced by any production code path.
- Lovable AI Gateway is disconnected at the project level; the manual disconnect step is documented in the repo README.
- Any leftover `@ai-sdk/openai-compatible` provider helper, `ai-gateway.server.ts`, or Lovable-gateway-pointed `/api/chat` routes are deleted.
- CI gate rejects reintroduction of `ai.gateway.lovable.dev`, `Lovable-API-Key`, or `createLovableAiGatewayProvider`.

### US-10 — zeroclaw owns LLM provider/model routing (OD-28)
As the operator, I want LLM provider and model selection to be owned by zeroclaw so that there is one routing authority, not two.

**Acceptance:**
- The `zeroclaw` plugin carries `selected_provider` / `selected_model` as the single routing authority.
- The `op-llm` crate's runtime switching (`switch_provider` / `switch_model` via `/api/llm/*`) is removed and consolidated under zeroclaw.
- `SendRequest` to `ChatService` carries the provider/model selection from zeroclaw; `op-web` does not make routing decisions.
- `gemma_brain` applies compliance tags and consumes the `large_language_model` plugin for projections, but does not select the model.
- The chatbot model is interchangeable — gemma is just one model in this model-agnostic stack.

### US-11 — Chat persistence via memory loop + cognitive-mcp
As the system, I want chat conversation persistence handled by the memory loop and cognitive-mcp so that there is no database dependency and conversations are semantically searchable.

**Acceptance:**
- No Supabase, no browser localStorage, no XDG JSON files for chat state.
- Chat transcripts are fed into the memory loop as `evt.*` records.
- Conversations are recalled by semantic search through cognitive-mcp's Qdrant-backed memory tools.
- The native client never writes chat state to disk directly; it dispatches memory-store actions through the existing gRPC → D-Bus → cognitive-mcp path.
- If threaded, `thread_id` is a cognitive-mcp memory key, not a database row ID.

---

## 2. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Cold-start of `zeroclaw-gui` to first rendered frame < 500ms on operator workstation. |
| NFR-2 | gRPC-Web bootstrap (reflection + descriptor pool load) < 1s on LAN. |
| NFR-3 | Schema renderer handles ≥10k-node payloads via virtualization without dropping frames. |
| NFR-4 | High-frequency streams update store imperatively (no per-frame React/egui repaint storm). |
| NFR-5 | Chat tokens stream end-to-end with <150ms p50 first-token latency for gemma (local) on operator LAN. Remote provider latency depends on provider. |
| NFR-6 | Masking rules (`mem://features/security-masking`) enforced on every rendered payload, including tool results in chat. |
| NFR-7 | Native binary contains no JS runtime, no Chromium, no webview. |

## 3. Out of scope

- Mobile or tablet operator console.
- Multi-operator collaborative editing inside the chat panel.
- React workspace chat mirror (chat is native-only).

## 4. Open questions

- Chat conversation shape: threaded or single? (must be answered via `questions--ask_questions` before T-Chat-1).
- Should tool approval (`needsApproval`) gate destructive backplane ops by default?
