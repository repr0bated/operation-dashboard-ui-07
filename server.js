// Tiny static server. Real UI is the native Rust egui client (`cargo run --release`).
// This exists only so the Lovable preview has something to serve.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const PORT = Number(process.env.PORT) || 8080;
const HTML = `<!doctype html><meta charset="utf-8"><title>ZeroClaw</title>
<style>body{background:#0B0D10;color:#E6E8EC;font:14px/1.6 system-ui;padding:48px;max-width:720px;margin:auto}
h1{color:#E5484D;font-weight:600}code{background:#171B21;padding:2px 6px;border-radius:4px;color:#E6E8EC}</style>
<h1>ZeroClaw — native Rust egui client</h1>
<p>This repo is a native binary. There is no web preview.</p>
<p>Build &amp; run locally:</p>
<pre><code>cargo run --release</code></pre>
<p>gRPC endpoint is picked up from <code>ZEROCLAW_GRPC</code>. All views auto-populate from server reflection.</p>`;

if (!existsSync("dist")) await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", HTML);

createServer((_, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(HTML);
}).listen(PORT, () => console.log(`stub preview on :${PORT}`));
