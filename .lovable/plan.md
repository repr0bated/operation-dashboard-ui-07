## Goal

A new **Reflection** page that talks to `grpc.reflection.v1.ServerReflection` on the bridge and shows the *live* set of services + methods (and their input/output message types) projected from whatever D-Bus plugin objects are currently registered. The list re-syncs automatically so new plugins appear without a reload.

The existing `GrpcExplorerPage` keeps its hand-curated streams. This new view is the schemaless, "what's actually on the wire right now" counterpart.

## What gets built

### 1. Reflection proto + client
- Add `proto/reflection/v1/reflection.proto` (the canonical `grpc.reflection.v1` definitions: `ServerReflectionRequest`, `ServerReflectionResponse`, `ListServiceResponse`, `FileDescriptorResponse`, etc.).
- Wire it into the existing `protoc` codegen pipeline so `src/grpc/gen/reflection/v1/reflection.{ts,client.ts}` is produced alongside the others.
- Add `getServerReflectionClient()` to `src/grpc/transport.ts`.

### 2. Descriptor decoder
- `src/lib/reflection/decode.ts` — feed `FileDescriptorProto` bytes (returned by reflection) into `protobufjs`'s `Root.fromDescriptor` to build an in-memory `Root` that knows every service, method, and message.
- Use `protobufjs/minimal` plus the descriptor-decoding helpers (already a transitive dep of `@protobuf-ts/runtime`, will add `protobufjs` explicitly if missing).
- Export typed records:
  ```ts
  type ReflectedMethod = {
    service: string; method: string;
    inputType: string; outputType: string;
    clientStreaming: boolean; serverStreaming: boolean;
  };
  type ReflectedService = { fullName: string; methods: ReflectedMethod[]; fileName: string; };
  ```

### 3. Live registry hook
- `src/hooks/use-reflection-registry.ts`
  - Opens a single bidi `ServerReflectionInfo` stream.
  - Sends `ListServices` on connect, then `FileContainingSymbol` for each unseen service.
  - Stores results in a Zustand slice (`useReflectionStore`) keyed by service full name.
  - Re-polls `ListServices` every N seconds (default 5s) **and** on a `ComponentRegistry.Watch` event (plugins come/go signal), so newly minted D-Bus-backed services show up promptly without rebuilding the descriptor cache from scratch.
  - Diff old vs new service set → emits `added` / `removed` for UI badges.

### 4. Page: `src/pages/ReflectionPage.tsx`
- Route `/reflection`, added to `AppShell` nav under the gRPC section.
- Layout: left rail = service tree (grouped by proto file / package), right pane = selected service detail.
- Service detail shows:
  - Full name, source file, method count.
  - Methods table: name, kind (unary / server-stream / client-stream / bidi), input type, output type.
  - Click a message type → side drawer with the decoded `MessageDescriptor` (fields, types, repeated/optional, nested enums) using the existing `SchemaRenderer`.
- Header chips: total services, total methods, "+N new" since last poll, last-sync timestamp, refresh button.
- Empty / loading / error states use existing `PageHeader` + `Card` primitives.
- "Open in Explorer" button on streaming methods deep-links to `/explorer?method=…` when the method id is also in the curated catalog; otherwise greyed with tooltip "not yet in invoke catalog".

### 5. Tests
- `src/lib/reflection/decode.test.ts` — feed a fixture `FileDescriptorSet` (a couple of the project's existing protos compiled with `protoc --descriptor_set_out`) and assert the parsed service/method shape.
- `src/hooks/use-reflection-registry.test.ts` — mocked transport that emits two ListServices snapshots with a new service in the second; assert the store diff fires `added`.

## Technical notes

```text
┌──────────────────┐  bidi stream   ┌──────────────────────────┐
│ ReflectionPage   │ ─────────────▶ │ grpc.reflection.v1       │
│   useReflection  │ ◀───────────── │ ServerReflectionInfo     │
│   Registry()     │  FileDesc+List │ (op-grpc-bridge)         │
└────────┬─────────┘                └──────────────────────────┘
         │                                  ▲
         │ ComponentRegistry.Watch          │ dbus object
         ▼                                  │ created/destroyed
   re-list services ────────────────────────┘
```

- Reflection responses are deduped by file name (`FileDescriptorProto.name`) so descriptors are only parsed once even if many services share a file.
- All work is client-side projection; no backend changes are required as long as `op-grpc-bridge` already enables `tonic-reflection` (the Rust `.zeroclaw/` GUI uses it, so it's on).
- Pure presentation — fits "all UI rendering goes through json-render.dev" because the per-method/message detail uses the existing `SchemaRenderer`, not a bespoke widget.

## Out of scope (follow-ups)

- Dynamic *invocation* of arbitrary unary methods from the Reflection view (the Rust GUI has this; the web version would need a `DynamicMessage` encoder — separate task).
- Persisting reflected descriptors to disk / IndexedDB for offline browsing.
- Surfacing the underlying D-Bus object path for each reflected service (needs a bridge-side annotation; tracked separately).
