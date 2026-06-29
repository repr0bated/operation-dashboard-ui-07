# Spec — Operator Console Topology (interface contract)

## 1. Network surface

| Endpoint | Transport | Purpose |
|---|---|---|
| `:50051` | gRPC-Web (HTTP/1.1, 5-byte framing) | Primary RPC and streams |
| `:50052` | gRPC-Web (HTTP/1.1, 5-byte framing) | Secondary / sharded RPC |
| `/sse/*`, `/ws/*` (via nginx) | SSE / WebSocket | High-frequency state sidecar |
| Qdrant `10.149.181.190:6334` | gRPC | Vector ops (backplane only, not client-reachable) |

All client traffic flows through nginx. The native client speaks only gRPC-Web + the SSE/WS sidecar.

## 2. gRPC contracts (delta)

### 2.1 ChatService (new)

```protobuf
service ChatService {
  rpc Send(SendRequest) returns (stream ChatFrame);
  rpc Approve(ApproveRequest) returns (ApproveResponse);
  rpc Cancel(CancelRequest) returns (CancelResponse);
}

message SendRequest {
  string conversation_id = 1;
  bytes  ui_messages = 2;       // JSON-encoded UIMessage[] (AI SDK shape)
  optional string persona_id = 3;
  string provider = 4;          // zeroclaw-selected provider (OD-28)
  string model = 5;             // zeroclaw-selected model (OD-28)
}

message ChatFrame {
  uint64 cursor = 1;
  oneof body {
    UIMessagePart part = 2;     // streamed AI SDK part (text/tool-call/tool-result/reasoning)
    StreamError   error = 3;
    Heartbeat     heartbeat = 4;
    StreamDone    done = 5;
  }
}

message UIMessagePart {
  string message_id = 1;
  string role = 2;              // "assistant" | "tool" | "system"
  string kind = 3;              // "text" | "tool-call" | "tool-result" | "reasoning"
  bytes  payload = 4;           // JSON bytes matching the AI SDK part shape
}
```

Wire format: project-standard gRPC-Web with 5-byte length-prefixed framing. The server re-encodes the AI SDK SSE stream into `ChatFrame` events; nothing about the AI SDK shape leaks past `payload`.

### 2.2 ReflectionService

Standard gRPC `ServerReflection` v1. Client bootstraps by listing services, fetching `FileDescriptorProto` blobs, and loading them into a `prost_reflect::DescriptorPool`. Pool is the single source of truth for decoding any RPC response into `serde_json::Value`.

## 3. Schema contract

```rust
// op-plugins side
#[derive(serde::Serialize, schemars::JsonSchema)]
pub struct DemoPluginState { /* ... */ }
```

```rust
// zeroclaw-gui side
let schema = schema_for!(DemoPluginState);   // Draft 2020-12
let value  = grpc::decode_to_json(dynamic);  // serde_json::Value
schema::render_value(ui, &schema, &value);
```

**Invariants:**
- Every plugin state struct derives `schemars::JsonSchema`.
- `schema::render_value` never panics; unknown constructs render a labeled diagnostic.
- Raw `pretty_json` fallback is allowed only inside an explicit diagnostic frame.

## 4. Chat inference contract (server)

`gemma_brain` handles routing, compliance tagging, and projection ownership. The chatbot model is **interchangeable** — `gemma_brain` routes chat requests to whichever model backend is selected by zeroclaw (OD-28). Only gemma is local-only; other models in the stack may be remote providers (e.g. Anthropic, OpenAI). `op-web` is the gRPC façade and tool dispatcher. There is **no** AI SDK provider, no `streamText` call, no `LOVABLE_API_KEY`, and no Lovable AI Gateway. The `op-llm` crate's runtime switching is removed; zeroclaw owns provider/model selection.

```rust
// op-web ChatService — sketch
async fn send(req: SendRequest) -> impl Stream<Item = ChatFrame> {
    let persona = personas.resolve(req.persona_id).await?;
    let tools   = registry.tools_for(&persona);
    let cursor  = cursor::start();

    // zeroclaw owns provider/model selection (req.provider, req.model).
    // gemma_brain routes to the selected backend and applies compliance tags.
    let mut model_stream = gemma_brain
        .route_chat(req.provider, req.model, persona.system_prompt, req.ui_messages, &tools, /*max_steps=*/ 50)
        .await?;

    while let Some(part) = model_stream.next().await {
        match part {
            ModelPart::Text(t)        => yield ChatFrame::part(cursor.bump(), "text", t),
            ModelPart::ToolCall(c)    => yield ChatFrame::part(cursor.bump(), "tool-call", c),
            ModelPart::ToolResult(r)  => yield ChatFrame::part(cursor.bump(), "tool-result", r),
            ModelPart::Reasoning(r)   => yield ChatFrame::part(cursor.bump(), "reasoning", r),
        }
    }
    yield ChatFrame::done(cursor.bump());
}
```

**Rules:**
- All inference routes through `gemma_brain`. Only gemma is local-only; other models may be remote providers. No Lovable AI Gateway.
- `op-llm` runtime switching is removed; zeroclaw owns `selected_provider` / `selected_model` (OD-28).
- Tools are defined in Rust with `schemars` input schemas; each tool wraps an `op-plugins` RPC and runs server-side only.
- Mutating tools require approval; approval round-trips via `ChatService.Approve` before `execute` is called.
- Agent loop bounded at ≥50 steps; cancellable via `ChatService.Cancel`.
- Wire vocabulary mirrors AI SDK `UIMessage` part kinds (`text` / `tool-call` / `tool-result` / `reasoning`) so renderers stay portable — this is a wire-format choice, not a runtime dependency on the AI SDK.
- Structured tool outputs are JSON validated against the tool's declared `schemars` schema before being framed.

## 5. Native chat rendering contract

## 5. Native chat rendering contract

The chat view is the Antigravity IDE interface, JSON-rendered through the json-render DSL interpreter (`generative-ui-catalog` spec) with the Antigravity SDK baked in. The egui renderer maps DSL node kinds to egui primitives; it does not invent new primitives.

| Antigravity SDK component | egui / DSL equivalent |
|---|---|
| `Conversation` + `ConversationContent` + `ConversationScrollButton` | `chat::view::transcript` with sticky-to-bottom |
| `Message` / `MessageContent` / `MessageResponse` | `chat::view::message` (role-styled, markdown-rendered) |
| `Tool` / `ToolHeader` / `ToolInput` / `ToolOutput` | `chat::view::tool_card` (input collapsed by default, including completed/error) |
| `PromptInput` / `PromptInputTextarea` / `PromptInputSubmit` | `chat::view::composer` (always-focused, status-aware submit) |
| `Shimmer` | `chat::view::thinking` ("Thinking…" while `submitted`) |

**Style invariants:**
- Assistant messages: no background bubble; render on the page surface.
- User messages: filled bubble with a deliberate high-contrast token pair from `theme.rs`.
- Identity glyph: domain-specific operator console mark, never `Sparkles`, never tied to a specific model.
- Tool input/output cards stay collapsed by default in all states.

## 6. Conversation & storage contract

Conversation persistence is handled by the **memory loop** (`mem://features/memory-loop`) backed by **cognitive-mcp** (`100.90.37.254:3003`). No Supabase, no browser localStorage, no XDG JSON files.

- **Memory loop** owns the conversation lifecycle: append, recall, summarization, eviction. Chat transcripts are fed into the loop as `evt.*` records and recalled by semantic search through cognitive-mcp's Qdrant-backed memory tools.
- **cognitive-mcp** is the persistence gateway. The native client never writes chat state to disk directly; it dispatches memory-store actions through the existing gRPC → D-Bus → cognitive-mcp path.
- Conversation shape (threaded vs. single) is still gathered via `questions--ask_questions` before implementation, but storage is settled: memory loop + cognitive-mcp, always.
- If threaded → `Route::Chat(thread_id)` in `nav.rs` for native; `thread_id` is a cognitive-mcp memory key, not a database row ID.

## 7. Observability

- Every `ChatFrame` cursor + tool call/result hash logged to the reasoning-audit pipeline (`mem://features/accountability/reasoning-audit`).
- gRPC-Web diagnostics surface in the existing diagnostics panel (`mem://features/grpc-diagnostics`).
- Per-tool latency + approval outcomes counted; surfaced in the management dashboards (`mem://features/infrastructure/management-dashboards`).

## 8. Removed surfaces

- `op-web::handlers::gemma`
- `op-web::handlers::ui_gallery`
- `op-web` routes `/api/gemma/*`
- `op-llm` runtime switching (`switch_provider` / `switch_model` / `/api/llm/*`) — consolidated into zeroclaw (OD-28)
- rust-embed of Vite `dist/` in `op-web`
- Any Lovable AI Gateway provider helper (`createLovableAiGatewayProvider`, `ai-gateway.server.ts`)
- Any `/api/chat` or `supabase/functions/chat` route pointing at `ai.gateway.lovable.dev`
- `LOVABLE_API_KEY` from project secrets
- React workspace chat mirror (chat is native-only)

CI gate must reject reintroduction of any of the above, including the strings `ai.gateway.lovable.dev`, `Lovable-API-Key`, `LOVABLE_API_KEY`, `createLovableAiGatewayProvider`, and `/api/llm/*` routes.
