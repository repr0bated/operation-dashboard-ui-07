# Static draft pages

One JSON file per route. The GUI hot-reloads these while running — edit,
save, and the page updates in the app within ~1s. No rebuild.

- Filename = route enum variant, lowercase: `overview.json`, `grpc.json`,
  `privacynetwork.json`, `grpcexplorer.json`, …
- A page here **overrides** the built-in Rust view for that route and shows a
  `STATIC DRAFT` badge. Delete the file to fall back.
- `data` is a canned stand-in for the live gRPC payload (gemma catalog, xray
  daemon, reflection services). `bind` paths are JSON pointers into it.

## File format

```json
{
  "title":  "human title (optional)",
  "spec":   { "kind": "stack", "children": [ ... ] },
  "data":   { "static": "sample payload" },
  "source": { "plugin": "gemma_brain", "method": "get_ui_spec",
              "args": [], "poll_secs": 5 }
}
```

## Live data (`source`)

`source` names a D-Bus plugin object on the same server, reached through
`operation.v1.PluginService/CallMethod` over the existing gRPC bridge — the
same path `zcall <plugin> <method>` takes. Discover targets with
`zcall list` and `zcall methods <plugin>`.

The GUI polls the method every `poll_secs` and, once the unwrapped `result`
is non-empty, uses it as the bind root instead of `data`. While the plugin
is unreachable or returns empty, `data` keeps the page rendering and the
status line under the draft badge says why. Auth headers
(`x-ghostbridge-footprint`/`x-ghostbridge-trace-id`) are read from the
identity sled at `/dev/shm/plugin_schema.dat` (`ZCALL_SLED_PATH` overrides).

## DSL kinds (src/catalog/interpret.rs)

| kind | fields |
|---|---|
| `stack` | `dir`: `"v"`/`"h"`, `children` |
| `card` | `children` — surface panel with border |
| `heading` | `text`, `size` |
| `label` | `text` or `bind` (JSON pointer into `data`) |
| `muted` | `text` — small grey text |
| `status_pill` | `bind` → `ok/up/healthy`, `warn/degraded`, `err/down/failed` |
| `button` | `label` (dispatch wiring lands with InvokeHandle) |
| `repeat` | `bind` → array; renders `child` per item with item as root |
| `separator` | — |
| `space` | `px` |

## Finalising

When a page is final, embed it:

```bash
cargo build --release --features embed-pages
```

Same files, compiled into the binary via `include_dir`; disk scanning and the
draft badge turn off. Longer term, finalised specs get minted into the gemma
catalog as versioned elements — the DSL is identical.

Dev pages dir resolution: `$ZEROCLAW_GUI_PAGES` → `./pages` → crate dir.
