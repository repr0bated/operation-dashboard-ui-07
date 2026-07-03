// Placeholder dev server so Lovable's preview healthcheck passes.
// This repo is pure Rust (native eframe/egui). Build the real app with:
//     cargo run --release
const http = require("http");
const PORT = 8080;
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>ZeroClaw — Native Rust</title>
<style>
  body { background:#0e1013; color:#e6e6e6; font-family: ui-monospace, "JetBrains Mono", monospace;
         display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  .card { max-width:640px; padding:32px 40px; border:1px solid #2a2f36; border-radius:8px; background:#15181d; }
  h1 { color:#e5484d; margin:0 0 12px; font-size:20px; letter-spacing:.02em; }
  code { background:#0a0c0f; padding:2px 6px; border-radius:4px; color:#f0f0f0; }
  p { line-height:1.55; color:#b8bcc4; }
</style></head>
<body><div class="card">
  <h1>ZeroClaw — Native Operator Console</h1>
  <p>This project is pure Rust (<code>eframe</code> / <code>egui</code>). Lovable's browser preview does not apply.</p>
  <p>Build and run locally:</p>
  <p><code>cargo run --release</code></p>
  <p>Point at a remote core: <code>ZEROCLAW_GRPC=https://op.local:443 cargo run --release</code></p>
</div></body></html>`;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HTML);
}).listen(PORT, "0.0.0.0", () => console.log(`placeholder preview on :${PORT}`));
