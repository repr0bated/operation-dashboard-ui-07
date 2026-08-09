import { useState } from "react";
import { Check, Copy, Terminal, Package, Shield, Network, Database, Cpu, GitBranch, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey =
  | "overview"
  | "prereqs"
  | "fetch"
  | "build"
  | "services"
  | "network"
  | "data"
  | "verify";

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: "overview", label: "Overview", icon: GitBranch },
  { key: "prereqs", label: "Prerequisites", icon: Package },
  { key: "fetch", label: "Fetch Sources", icon: GitBranch },
  { key: "build", label: "Build", icon: Cpu },
  { key: "services", label: "Services", icon: Play },
  { key: "network", label: "Privacy Network", icon: Network },
  { key: "data", label: "Data Stores", icon: Database },
  { key: "verify", label: "Verify", icon: Shield },
];

function CodeBlock({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="rounded-md border border-border bg-muted/30 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Terminal className="h-3 w-3" />
            {label}
          </span>
          <button
            onClick={copy}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <pre className="p-3 text-[12px] font-mono leading-relaxed overflow-x-auto text-foreground/90 whitespace-pre">
        {children}
      </pre>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function InstallPage() {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          <Shield className="h-3 w-3" />
          ZeroClaw
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Full Install</h1>
        <p className="text-sm text-muted-foreground">
          End-to-end provisioning of the ZeroClaw control plane on Artix Linux: op-web server, s6
          supervised services, gRPC mirror, privacy mesh, and the embedding pipeline.
        </p>

      </header>

      {/* Sub-tabs */}
      <div className="border-b border-border flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-8 pb-12">
        {tab === "overview" && (
          <>
            <Section title="What gets installed">
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="text-foreground font-medium">op-web</span> — Rust HTTP/gRPC-Web server embedding this SPA via rust-embed.</li>
                <li><span className="text-foreground font-medium">op-core</span> — D-Bus mirror, plugin registry, state projection store.</li>
                <li><span className="text-foreground font-medium">op-agent</span> — LLM router, persona engine, tool executor.</li>
                <li><span className="text-foreground font-medium">s6 + s6-rc</span> — Supervises every component as a managed service on Artix Linux.</li>
                <li><span className="text-foreground font-medium">Qdrant</span> — Vector store for knowledge + audit search (<code className="font-mono text-xs">10.149.181.190:6334</code>).</li>
                <li><span className="text-foreground font-medium">WireGuard + XRay + WARP</span> — Layered privacy mesh.</li>
              </ul>
            </Section>
            <Section title="Target topology">
              <CodeBlock>{`┌─ op-web :443 (TLS) ────────────────────────┐
│   embeds SPA → /                            │
│   nginx → gRPC-Web :50051 (state)           │
│           gRPC-Web :50052 (assistant)       │
└─────────────────────────────────────────────┘
        │
   ┌────┴─────┬──────────┬──────────┐
 op-core    op-agent   qdrant     embed-worker
   │           │          │            │
  D-Bus     s6-rc/s6-svc :6334      blockchain feed`}</CodeBlock>
            </Section>
            <Section title="Estimated time">
              <p>~25 min on a clean Artix Linux host with 8 cores / 16 GB RAM.</p>
            </Section>
          </>
        )}

        {tab === "prereqs" && (
          <>
            <Section title="System requirements">
              <ul className="list-disc pl-5 space-y-1">
                <li>Artix Linux (x86_64 or aarch64) — s6 init flavour recommended</li>
                <li>Linux kernel ≥ 6.1 with WireGuard module</li>
                <li>BTRFS root or dedicated subvolume for snapshots</li>
                <li>systemd-free init — ZeroClaw runs under <code className="font-mono">s6</code> + <code className="font-mono">s6-rc</code></li>
              </ul>
            </Section>
            <Section title="Base packages">
              <CodeBlock label="artix linux">{`sudo pacman -Syu --needed \\
  base-devel pkgconf openssl dbus \\
  protobuf clang lld git curl \\
  wireguard-tools nftables btrfs-progs \\
  nginx ca-certificates \\
  s6 s6-rc s6-linux-init`}</CodeBlock>

            </Section>
            <Section title="Rust toolchain">
              <CodeBlock>{`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup default stable
rustup target add wasm32-unknown-unknown`}</CodeBlock>
            </Section>
            <Section title="Node toolchain (for SPA build)">
              <CodeBlock>{`curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"`}</CodeBlock>
            </Section>
          </>
        )}

        {tab === "fetch" && (
          <>
            <Section title="Clone the monorepo">
              <CodeBlock>{`sudo install -d -o $USER /opt/zeroclaw
cd /opt/zeroclaw
git clone https://git.zeroclaw.dev/zeroclaw/zeroclaw.git .
git submodule update --init --recursive`}</CodeBlock>
            </Section>
            <Section title="Layout">
              <CodeBlock>{`/opt/zeroclaw
├── crates/
│   ├── op-web/         # Axum + rust-embed + gRPC-Web
│   ├── op-core/        # D-Bus mirror + state store
│   ├── op-agent/       # LLM router + personas
│   └── op-embed/       # Qdrant ingestion worker
├── proto/              # shared .proto definitions
├── web/                # this SPA (Vite + React)
├── s6/                 # s6-rc service definitions (sv/ + bundles)
└── deploy/`}</CodeBlock>
            </Section>
            <Section title="Pin a release (optional)">
              <CodeBlock>{`git fetch --tags
git checkout v0.9.0`}</CodeBlock>
            </Section>
          </>
        )}

        {tab === "build" && (
          <>
            <Section title="Build the SPA">
              <CodeBlock label="web/">{`cd /opt/zeroclaw/web
bun install
bun run build
# emits ./dist consumed by op-web via rust-embed`}</CodeBlock>
            </Section>
            <Section title="Build the Rust workspace (release)">
              <CodeBlock>{`cd /opt/zeroclaw
cargo build --release --workspace
# binaries land in ./target/release/{op-web,op-core,op-agent,op-embed}`}</CodeBlock>
            </Section>
            <Section title="Install binaries">
              <CodeBlock>{`sudo install -d /usr/local/libexec/zeroclaw
sudo install -m 0755 target/release/op-web    /usr/local/libexec/zeroclaw/
sudo install -m 0755 target/release/op-core   /usr/local/libexec/zeroclaw/
sudo install -m 0755 target/release/op-agent  /usr/local/libexec/zeroclaw/
sudo install -m 0755 target/release/op-embed  /usr/local/libexec/zeroclaw/`}</CodeBlock>
            </Section>
            <Section title="Default config">
              <CodeBlock label="/etc/zeroclaw/op.toml">{`[web]
listen = "0.0.0.0:8443"
tls_cert = "/etc/zeroclaw/tls/fullchain.pem"
tls_key  = "/etc/zeroclaw/tls/privkey.pem"

[grpc]
state_addr     = "127.0.0.1:8090"
assistant_addr = "127.0.0.1:50052"

[qdrant]
url = "http://10.149.181.190:6334"

[agent]
personas = "/etc/zeroclaw/personas.yaml"`}</CodeBlock>
            </Section>
          </>
        )}

        {tab === "services" && (
          <>
            <Section title="Install s6 + s6-rc">
              <CodeBlock>{`# Artix Linux ships s6 in its official repos
sudo pacman -S --needed s6 s6-rc s6-linux-init
sudo install -d /etc/s6/sv /etc/s6/rc /var/log/zeroclaw`}</CodeBlock>
            </Section>
            <Section title="Service definitions (s6-rc source)">
              <CodeBlock label="/etc/s6/sv/op-core/type">{`longrun`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-core/run">{`#!/bin/execlineb -P
fdmove -c 2 1
exec /usr/local/libexec/zeroclaw/op-core --config /etc/zeroclaw/op.toml`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-core/dependencies.d/dbus">{`# empty file — declares dbus dependency`}</CodeBlock>

              <CodeBlock label="/etc/s6/sv/op-agent/type">{`longrun`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-agent/run">{`#!/bin/execlineb -P
fdmove -c 2 1
exec /usr/local/libexec/zeroclaw/op-agent --config /etc/zeroclaw/op.toml`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-agent/dependencies.d/op-core">{`# empty file — declares op-core dependency`}</CodeBlock>

              <CodeBlock label="/etc/s6/sv/op-web/type">{`longrun`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-web/run">{`#!/bin/execlineb -P
fdmove -c 2 1
exec /usr/local/libexec/zeroclaw/op-web --config /etc/zeroclaw/op.toml`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-web/dependencies.d/op-agent">{`# empty file`}</CodeBlock>

              <CodeBlock label="/etc/s6/sv/zeroclaw/type">{`bundle`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/zeroclaw/contents">{`op-core
op-agent
op-web`}</CodeBlock>
            </Section>
            <Section title="Compile and bring services up">
              <CodeBlock>{`# Compile the source dir into the live database
sudo s6-rc-compile /etc/s6/compiled-$(date +%s) /etc/s6/sv
sudo ln -sfn /etc/s6/compiled-* /etc/s6/compiled

# Activate the zeroclaw bundle
sudo s6-rc -u change zeroclaw

# Inspect
sudo s6-rc -a list           # all active services
sudo s6-svstat /run/service/op-core
sudo s6-svstat /run/service/op-web`}</CodeBlock>
            </Section>
          </>
        )}


        {tab === "network" && (
          <>
            <Section title="WireGuard mesh">
              <CodeBlock label="/etc/wireguard/zc0.conf">{`[Interface]
Address    = 10.149.181.10/24
ListenPort = 51820
PrivateKey = <generated>

[Peer]
PublicKey  = <hub-pubkey>
Endpoint   = hub.zeroclaw.dev:51820
AllowedIPs = 10.149.181.0/24
PersistentKeepalive = 25`}</CodeBlock>
              <CodeBlock>{`sudo wg-quick up zc0
sudo s6-rc -u change wg-zc0   # bundle wrapping wg-quick up zc0`}</CodeBlock>
            </Section>
            <Section title="XRay obfuscation (optional)">
              <p>Used as fallback transport when carrier networks block WireGuard. Config lives at <code className="font-mono text-xs">/etc/zeroclaw/xray.json</code> — see the Privacy Network panel for the live routing graph after services start.</p>
            </Section>
            <Section title="nginx reverse proxy">
              <CodeBlock label="/etc/nginx/sites-available/zeroclaw">{`server {
  listen 443 ssl http2;
  server_name ops.zeroclaw.local;

  location /grpc.state.v1.       { grpc_pass grpc://127.0.0.1:50051; }
  location /grpc.assistant.v1.   { grpc_pass grpc://127.0.0.1:50052; }
  location /                     { proxy_pass http://127.0.0.1:8443; }
}`}</CodeBlock>
            </Section>
          </>
        )}

        {tab === "data" && (
          <>
            <Section title="Qdrant vector store">
              <CodeBlock>{`docker run -d --name qdrant \\
  --restart=unless-stopped \\
  -p 6333:6333 -p 6334:6334 \\
  -v /var/lib/qdrant:/qdrant/storage \\
  qdrant/qdrant:latest`}</CodeBlock>
              <p>Bind it on the WireGuard interface only (<code className="font-mono text-xs">10.149.181.190</code>) — never expose <code className="font-mono text-xs">:6334</code> publicly.</p>
            </Section>
            <Section title="BTRFS subvolumes">
              <CodeBlock>{`sudo btrfs subvolume create /var/lib/zeroclaw/state
sudo btrfs subvolume create /var/lib/zeroclaw/audit
sudo btrfs subvolume create /var/lib/zeroclaw/snapshots`}</CodeBlock>
            </Section>
            <Section title="Embedding worker">
              <CodeBlock label="/etc/s6/sv/op-embed/type">{`longrun`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-embed/run">{`#!/bin/execlineb -P
fdmove -c 2 1
exec /usr/local/libexec/zeroclaw/op-embed --config /etc/zeroclaw/op.toml`}</CodeBlock>
              <CodeBlock label="/etc/s6/sv/op-embed/dependencies.d/op-core">{`# empty file`}</CodeBlock>
              <CodeBlock>{`sudo s6-rc-compile /etc/s6/compiled-$(date +%s) /etc/s6/sv
sudo ln -sfn /etc/s6/compiled-* /etc/s6/compiled
sudo s6-rc -u change op-embed`}</CodeBlock>

            </Section>
          </>
        )}

        {tab === "verify" && (
          <>
            <Section title="Health checks">
              <CodeBlock>{`# 1. s6-rc reports all services up
sudo s6-rc -a list


# 2. gRPC reflection
grpcurl -plaintext $(grep -oP '(?<=grpcBaseUrl":")[^"]*' window.__OPDBUS_CONFIG__ 2>/dev/null || echo "localhost:8090"):8090 list

# 3. Web UI
curl -kI https://ops.zeroclaw.local/

# 4. Qdrant
curl -s http://10.149.181.190:6333/collections | jq .

# 5. WireGuard handshake within last 3 min
sudo wg show zc0 latest-handshakes`}</CodeBlock>
            </Section>
            <Section title="Open the console">
              <p>
                Browse to <code className="font-mono text-xs">https://ops.zeroclaw.local/</code> and the
                topbar should report <span className="text-foreground font-medium">Health OK</span>.
                Visit <code className="font-mono text-xs">/grpc</code> for stream diagnostics and{" "}
                <code className="font-mono text-xs">/state</code> for the live D-Bus mirror.
              </p>
            </Section>
            <Section title="Roll back">
              <CodeBlock>{`sudo btrfs subvolume snapshot -r /var/lib/zeroclaw/state /var/lib/zeroclaw/snapshots/$(date +%s)
sudo s6-rc -d change op-web op-agent op-core op-embed`}</CodeBlock>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
