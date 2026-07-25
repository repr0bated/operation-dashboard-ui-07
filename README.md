# ZeroClaw — Native Operator Console

Native Rust GUI built on `eframe`/`egui`. Mirrors the layout, navigation, and theme of the web operator console while talking directly to the ZeroClaw core over **tonic + tonic-web** with **server reflection**.

## Run

```bash
cargo run --release
# point at a remote core:
ZEROCLAW_GRPC=https://op.local:443 cargo run --release
```

## Headless Wayland

If the host is headless, you still need a Wayland compositor. One simple option is Weston in headless mode:

```bash
sudo apt-get install weston
./scripts/run-headless-wayland.sh
```

The wrapper starts Weston with a private socket, waits for the Wayland display to appear, and then launches ZeroClaw against it.

## Architecture

```text
.zeroclaw/
├── Cargo.toml
└── src/
    ├── main.rs        # eframe entry + background tokio runtime
    ├── app.rs         # topbar + sidebar + routed shell
    ├── nav.rs         # NAV_GROUPS port (1:1 mirror of React nav)
    ├── theme.rs       # graphite/slate dark theme tokens
    ├── grpc.rs        # tonic-web client + ServerReflection bootstrap
    ├── schema.rs      # schemars Schema → egui renderer (schema-as-code)
    └── views/mod.rs   # per-route views (Inspector/State/gRPC are schema-driven)
```

## gRPC + reflection

`grpc.rs` opens a `tonic::transport::Channel` (works for both native gRPC and
`tonic-web` proxied endpoints), calls `ServerReflectionClient::server_reflection_info`,
and loads every returned `FileDescriptorProto` into a `prost_reflect::DescriptorPool`.

From the pool we can:

- enumerate services + methods (rendered in the **gRPC Diagnostics** view)
- decode any response payload into `serde_json::Value` via `DynamicMessage`
  (`grpc::decode_to_json`)

Server side (in `op-web`) needs:

```rust
let reflection = tonic_reflection::server::Builder::configure()
    .register_encoded_file_descriptor_set(zeroclaw_proto::FILE_DESCRIPTOR_SET)
    .register_encoded_file_descriptor_set(tonic_health::pb::FILE_DESCRIPTOR_SET)
    .build_v1()?;

Server::builder()
    .accept_http1(true)
    .layer(tonic_web::GrpcWebLayer::new())
    .add_service(reflection)
    .add_service(/* your services */)
    .serve(addr).await?;
```

## Schema-as-code

Plugins in `crates/op-plugins` already derive `schemars::JsonSchema` on their
state structs (`schemars = "1"`). Emit a schema with:

```rust
let schema = schemars::schema_for!(MyPluginState);
```

Ship that schema alongside the decoded JSON (from `grpc::decode_to_json`) and
call `schema::render_value(ui, &schema, &value)` — the GUI renders titles,
descriptions, required fields, enums, nested objects, and arrays with no
hand-written form code. See `views::inspector` / `views::state_view` for a live
demo using a `DemoPluginState` struct that mirrors the plugin contract.

## Adding a real plugin

1. In `op-plugins`, derive `#[derive(JsonSchema)]` on the state struct.
2. In `op-web`, return `(message_bytes, schemars::schema_for!(State))` on the
   relevant gRPC stream (or expose the schema via a sibling `GetSchema` RPC).
3. In this crate, decode with `grpc::decode_to_json` and render with
   `schema::render_value` — no per-plugin UI code required.

## Local gRPC (this host)

The React dashboard talks **binary gRPC-Web** to `op-grpc-bridge` on `:8090`.

```bash
# 1) Ensure bridge + identity sled
sv status op-grpc-bridge
test -f /dev/shm/plugin_schema.dat ||   sudo op-identity-sled --refresh --pubkey "$(sudo wg show 3tched public-key)"

# 2) Point .env at local endpoints (already defaults after 2026-07-22 fix)
#    VITE_GRPC_BASE_URL=http://127.0.0.1:8090
#    VITE_API_BASE_URL=http://127.0.0.1:8080/api
#    VITE_GHOSTBRIDGE_FOOTPRINT / TRACE_ID must match the sled

# 3) Dev
npm install --legacy-peer-deps
npm run dev          # http://127.0.0.1:5173/

# 4) Production static for op-web
./ui-render-update.sh
# → http://127.0.0.1:8080/
```

**Not JSON gRPC-Web** — tonic-web only accepts `application/grpc-web+proto`.
