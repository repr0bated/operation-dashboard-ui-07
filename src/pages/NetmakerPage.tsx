import { useState, useEffect, useCallback, useRef } from "react";
import {
  Radio,
  RefreshCw,
  Loader2,
  Network,
  Server,
  Activity,
  Terminal,
  ExternalLink,
  Globe,
  Wifi,
  WifiOff,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { netmakerService } from "@/grpc/client";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import type {
  Network as NetmakerNetwork,
  Node,
  Host,
  NetmakerEvent,
  ExecuteCommandRequest,
  ExecuteCommandResponse,
} from "@/grpc/gen/adapters";
import { HealthStatus, NetmakerEventType, ServiceType } from "@/grpc/gen/adapters";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "networks" | "hosts" | "events" | "cli";
type HealthState = { status: HealthStatus; version: string } | null;

// ── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 20_000;
const STREAM_RECONNECT_MS = 3_000;
const MAX_EVENTS = 500;

const NETMAKER_UI_URL = (import.meta.env.VITE_NETMAKER_UI_URL as string | undefined) || "";

// ── CLI command definitions ──────────────────────────────────────────────────

interface CliCommand {
  id: string;
  label: string;
  oneofKind: ExecuteCommandRequest["command"]["oneofKind"];
  params: { key: string; label: string; placeholder: string }[];
}

const CLI_COMMANDS: CliCommand[] = [
  { id: "list", label: "list", oneofKind: "list", params: [] },
  { id: "peers", label: "peers", oneofKind: "peers", params: [] },
  { id: "version", label: "version", oneofKind: "version", params: [] },
  { id: "pull", label: "pull", oneofKind: "pull", params: [] },
  { id: "push", label: "push", oneofKind: "push", params: [] },
  { id: "connect", label: "connect", oneofKind: "connect", params: [{ key: "network", label: "Network", placeholder: "network-name" }] },
  { id: "disconnect", label: "disconnect", oneofKind: "disconnect", params: [{ key: "network", label: "Network", placeholder: "network-name" }] },
  { id: "ping", label: "ping", oneofKind: "ping", params: [{ key: "peer", label: "Peer", placeholder: "peer-name-or-id" }] },
  { id: "register", label: "register", oneofKind: "register", params: [{ key: "instance", label: "Instance", placeholder: "instance-name" }] },
  { id: "server", label: "server", oneofKind: "server", params: [{ key: "subcommand", label: "Subcommand", placeholder: "e.g. list" }] },
  { id: "use", label: "use", oneofKind: "use", params: [{ key: "version", label: "Version", placeholder: "v0.24.0" }] },
  { id: "install", label: "install", oneofKind: "install", params: [] },
  { id: "uninstall", label: "uninstall", oneofKind: "uninstall", params: [] },
  { id: "join", label: "join", oneofKind: "join", params: [{ key: "network", label: "Network", placeholder: "network-name" }, { key: "token", label: "Token", placeholder: "enrollment-token" }] },
  { id: "leave", label: "leave", oneofKind: "leave", params: [{ key: "network", label: "Network", placeholder: "network-name" }] },
  { id: "restart", label: "restart", oneofKind: "restart", params: [] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function healthLabel(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY: return "Healthy";
    case HealthStatus.DEGRADED: return "Degraded";
    case HealthStatus.UNHEALTHY: return "Unhealthy";
    default: return "Unknown";
  }
}

function healthColor(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY: return "text-emerald-400";
    case HealthStatus.DEGRADED: return "text-yellow-400";
    case HealthStatus.UNHEALTHY: return "text-red-400";
    default: return "text-muted-foreground";
  }
}

function eventTypeLabel(t: NetmakerEventType): string {
  switch (t) {
    case NetmakerEventType.NODE_JOINED: return "Node Joined";
    case NetmakerEventType.NODE_LEFT: return "Node Left";
    case NetmakerEventType.NETWORK_CHANGED: return "Network Changed";
    default: return "Unknown";
  }
}

function eventTypeBadgeColor(t: NetmakerEventType): string {
  switch (t) {
    case NetmakerEventType.NODE_JOINED: return "border-emerald-500/40 text-emerald-400";
    case NetmakerEventType.NODE_LEFT: return "border-red-500/40 text-red-400";
    case NetmakerEventType.NETWORK_CHANGED: return "border-blue-500/40 text-blue-400";
    default: return "border-border text-muted-foreground";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NetmakerPage() {
  const [tab, setTab] = useState<Tab>("networks");
  const [health, setHealth] = useState<HealthState>(null);
  const [degraded, setDegraded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Networks tab state
  const [networks, setNetworks] = useState<NetmakerNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Hosts tab state
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);

  // Events tab state
  const [events, setEvents] = useState<{ event: NetmakerEvent; ts: string }[]>([]);
  const [streamStatus, setStreamStatus] = useState<"idle" | "streaming" | "error" | "reconnecting">("idle");
  const streamAbortRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CLI tab state
  const [selectedCommand, setSelectedCommand] = useState<CliCommand>(CLI_COMMANDS[0]);
  const [cliParams, setCliParams] = useState<Record<string, string>>({});
  const [cliRunning, setCliRunning] = useState(false);
  const [cliHistory, setCliHistory] = useState<{ cmd: string; result: ExecuteCommandResponse; ts: string }[]>([]);

  // ── Data fetching ──────────────────────────────────────────────────────

  const loadHealth = useCallback(async () => {
    try {
      const res = await netmakerService.getServerHealth();
      setHealth({ status: res.status, version: res.version });
    } catch {
      setHealth(null);
    }
  }, []);

  const loadNetworks = useCallback(async () => {
    try {
      const res = await netmakerService.listNetworks();
      setNetworks(res.networks ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadNodes = useCallback(async (network: string) => {
    setNodesLoading(true);
    try {
      const res = await netmakerService.listNodes({ network });
      setNodes(res.nodes ?? []);
    } catch {
      setNodes([]);
    } finally {
      setNodesLoading(false);
    }
  }, []);

  const loadHosts = useCallback(async () => {
    setHostsLoading(true);
    try {
      const res = await netmakerService.listHosts();
      setHosts(res.hosts ?? []);
    } catch {
      setHosts([]);
    } finally {
      setHostsLoading(false);
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    await Promise.all([loadHealth(), loadNetworks()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadHealth, loadNetworks]);

  // Initial load + auto-refresh
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Load nodes when a network is selected
  useEffect(() => {
    if (selectedNetwork) {
      loadNodes(selectedNetwork);
    } else {
      setNodes([]);
    }
  }, [selectedNetwork, loadNodes]);

  // Load hosts when hosts tab activates
  useEffect(() => {
    if (tab === "hosts") loadHosts();
  }, [tab, loadHosts]);

  // Detect degraded mode — if mutations fail with specific codes
  useEffect(() => {
    (async () => {
      try {
        // Try a lightweight probe — if executeCommand returns UNIMPLEMENTED,
        // the adapter isn't colocated and mutations are unavailable.
        await netmakerService.executeCommand({
          command: { oneofKind: "version", version: {} },
        });
        setDegraded(false);
      } catch {
        setDegraded(true);
      }
    })();
  }, []);

  // ── Event stream ───────────────────────────────────────────────────────

  const startStream = useCallback(() => {
    streamAbortRef.current?.();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setStreamStatus("streaming");

    const { stream, abort } = netmakerService.streamEvents();
    streamAbortRef.current = abort;

    const reader = stream.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const ev = value as NetmakerEvent;
          setEvents((prev) => {
            const next = [{ event: ev, ts: new Date().toISOString() }, ...prev];
            return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
          });
        }
        setStreamStatus("reconnecting");
        reconnectTimerRef.current = setTimeout(startStream, STREAM_RECONNECT_MS);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          setStreamStatus("idle");
        } else {
          setStreamStatus("error");
          reconnectTimerRef.current = setTimeout(startStream, STREAM_RECONNECT_MS);
        }
      }
    })();
  }, []);

  const stopStream = useCallback(() => {
    streamAbortRef.current?.();
    streamAbortRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setStreamStatus("idle");
  }, []);

  // Start stream when events tab opens
  useEffect(() => {
    if (tab === "events" && !degraded) {
      startStream();
    }
    return () => stopStream();
  }, [tab, degraded, startStream, stopStream]);

  // ── CLI execution ──────────────────────────────────────────────────────

  const executeCli = useCallback(async () => {
    if (cliRunning) return;
    setCliRunning(true);

    const cmd = selectedCommand;
    let request: ExecuteCommandRequest;

    switch (cmd.oneofKind) {
      case "list": request = { command: { oneofKind: "list", list: {} } }; break;
      case "peers": request = { command: { oneofKind: "peers", peers: {} } }; break;
      case "version": request = { command: { oneofKind: "version", version: {} } }; break;
      case "pull": request = { command: { oneofKind: "pull", pull: {} } }; break;
      case "push": request = { command: { oneofKind: "push", push: {} } }; break;
      case "install": request = { command: { oneofKind: "install", install: {} } }; break;
      case "uninstall": request = { command: { oneofKind: "uninstall", uninstall: {} } }; break;
      case "connect": request = { command: { oneofKind: "connect", connect: { network: cliParams.network ?? "" } } }; break;
      case "disconnect": request = { command: { oneofKind: "disconnect", disconnect: { network: cliParams.network ?? "" } } }; break;
      case "ping": request = { command: { oneofKind: "ping", ping: { peer: cliParams.peer ?? "" } } }; break;
      case "register": request = { command: { oneofKind: "register", register: { instance: cliParams.instance ?? "" } } }; break;
      case "server": request = { command: { oneofKind: "server", server: { subcommand: cliParams.subcommand ?? "", args: [] } } }; break;
      case "use": request = { command: { oneofKind: "use", use: { version: cliParams.version ?? "" } } }; break;
      case "join": request = { command: { oneofKind: "join", join: { network: cliParams.network ?? "", token: cliParams.token ?? "" } } }; break;
      case "leave": request = { command: { oneofKind: "leave", leave: { network: cliParams.network ?? "" } } }; break;
      case "restart": request = { command: { oneofKind: "restart", restart: { service: ServiceType.NETCLIENT } } }; break;
      default: request = { command: { oneofKind: undefined } }; break;
    }

    try {
      const result = await netmakerService.executeCommand(request);
      setCliHistory((prev) => [
        { cmd: `netclient ${cmd.label}${Object.values(cliParams).filter(Boolean).map(v => ` ${v}`).join("")}`, result, ts: new Date().toISOString() },
        ...prev,
      ]);
    } catch (err) {
      setCliHistory((prev) => [
        {
          cmd: `netclient ${cmd.label}`,
          result: { exitCode: -1, stdout: "", stderr: err instanceof Error ? err.message : String(err) },
          ts: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setCliRunning(false);
    }
  }, [selectedCommand, cliParams, cliRunning]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Network }[] = [
    { id: "networks", label: "Networks", icon: Network },
    { id: "hosts", label: "Hosts", icon: Server },
    { id: "events", label: "Events", icon: Activity },
    { id: "cli", label: "CLI Console", icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-foreground flex items-center gap-3">
            <Radio className="h-7 w-7 text-primary" />
            Netmaker
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mesh network management via op.adapters.v1.NetmakerService
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health && (
            <Badge variant="outline" className={cn("text-xs font-mono", healthColor(health.status))}>
              {healthLabel(health.status)} · v{health.version}
            </Badge>
          )}
          {NETMAKER_UI_URL ? (
            <a href={NETMAKER_UI_URL} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-7 gap-1.5">
                <ExternalLink className="h-3 w-3" /> Admin UI
              </Button>
            </a>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1.5" disabled title="Configure VITE_NETMAKER_UI_URL to enable">
              <ExternalLink className="h-3 w-3" /> Admin UI
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-7 gap-1.5"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Degraded banner ────────────────────────────────────── */}
      {degraded && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
          <Info className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-yellow-400">Read-only mode</strong> — Mutation commands
            (join, leave, restart, execute, stream) require the adapter deployed inside the
            NetMaker container's network namespace. Read methods are functional.
          </div>
        </div>
      )}

      {/* ── Error banner ───────────────────────────────────────── */}
      {error && !loading && <ErrorBanner title="Netmaker service error" message={error} />}

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {tab === "networks" && (
        <NetworksTab
          networks={networks}
          selectedNetwork={selectedNetwork}
          onSelectNetwork={setSelectedNetwork}
          nodes={nodes}
          nodesLoading={nodesLoading}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
      )}
      {tab === "hosts" && <HostsTab hosts={hosts} loading={hostsLoading} />}
      {tab === "events" && (
        <EventsTab
          events={events}
          status={streamStatus}
          degraded={degraded}
          onClear={() => setEvents([])}
        />
      )}
      {tab === "cli" && (
        <CliTab
          commands={CLI_COMMANDS}
          selectedCommand={selectedCommand}
          onSelectCommand={(cmd) => { setSelectedCommand(cmd); setCliParams({}); }}
          params={cliParams}
          onParamChange={(k, v) => setCliParams((p) => ({ ...p, [k]: v }))}
          onExecute={executeCli}
          running={cliRunning}
          history={cliHistory}
          degraded={degraded}
        />
      )}
    </div>
  );
}

// ── Networks Tab ─────────────────────────────────────────────────────────────

function NetworksTab({
  networks,
  selectedNetwork,
  onSelectNetwork,
  nodes,
  nodesLoading,
  selectedNode,
  onSelectNode,
}: {
  networks: NetmakerNetwork[];
  selectedNetwork: string | null;
  onSelectNetwork: (n: string | null) => void;
  nodes: Node[];
  nodesLoading: boolean;
  selectedNode: Node | null;
  onSelectNode: (n: Node | null) => void;
}) {
  if (networks.length === 0) {
    return <EmptyState title="No networks" hint="Netmaker has no networks configured, or the service is unreachable." />;
  }

  return (
    <div className="space-y-4">
      {/* Network cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {networks.map((net) => (
          <button
            key={net.name}
            type="button"
            onClick={() => onSelectNetwork(net.name === selectedNetwork ? null : net.name)}
            className={cn(
              "text-left rounded-lg border bg-card p-3 transition-colors",
              selectedNetwork === net.name
                ? "border-primary ring-1 ring-primary/30"
                : "border-border hover:border-muted-foreground/30",
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-foreground">{net.name}</span>
              {net.isLocal && (
                <Badge variant="outline" className="text-[10px] font-mono border-blue-500/40 text-blue-400">
                  local
                </Badge>
              )}
            </div>
            <div className="space-y-0.5 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 shrink-0" />
                {net.addressRange || "—"}
              </div>
              {net.addressRange6 && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3 w-3 shrink-0" />
                  {net.addressRange6}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Node table */}
      {selectedNetwork && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Nodes — {selectedNetwork}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {nodes.length}
              </Badge>
            </div>
            {nodesLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {nodes.length === 0 && !nodesLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No nodes in this network.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Address</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Public Key</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Last Check-in</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <tr
                      key={node.id}
                      onClick={() => onSelectNode(selectedNode?.id === node.id ? null : node)}
                      className={cn(
                        "border-b border-border/50 cursor-pointer transition-colors",
                        selectedNode?.id === node.id
                          ? "bg-primary/5"
                          : "hover:bg-muted/20",
                      )}
                    >
                      <td className="px-4 py-2 font-mono font-medium text-foreground">{node.name || "—"}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{node.address}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{truncate(node.publicKey, 16)}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {node.lastCheckin ? new Date(node.lastCheckin).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn("inline-flex items-center gap-1", node.connected ? "text-emerald-400" : "text-red-400")}>
                          {node.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {node.connected ? "Connected" : "Disconnected"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Node detail panel */}
      {selectedNode && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Node Detail</h3>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => onSelectNode(null)}>
              Close
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-foreground mt-0.5">{selectedNode.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-mono text-foreground mt-0.5">{selectedNode.name || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="font-mono text-foreground mt-0.5">{selectedNode.address}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Connected</dt>
              <dd className="mt-0.5">
                <span className={cn("font-mono", selectedNode.connected ? "text-emerald-400" : "text-red-400")}>
                  {selectedNode.connected ? "Yes" : "No"}
                </span>
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Public Key</dt>
              <dd className="font-mono text-foreground mt-0.5 break-all">{selectedNode.publicKey}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Last Check-in</dt>
              <dd className="font-mono text-foreground mt-0.5">
                {selectedNode.lastCheckin ? new Date(selectedNode.lastCheckin).toLocaleString() : "Never"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

// ── Hosts Tab ────────────────────────────────────────────────────────────────

function HostsTab({ hosts, loading }: { hosts: Host[]; loading: boolean }) {
  if (loading && hosts.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hosts.length === 0) {
    return <EmptyState title="No hosts" hint="No hosts registered in Netmaker." />;
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Server className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Host Inventory</span>
        <Badge variant="outline" className="text-[10px] font-mono">{hosts.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Public Key</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Version</th>
            </tr>
          </thead>
          <tbody>
            {hosts.map((host) => (
              <tr key={host.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2 font-mono font-medium text-foreground">{host.name || "—"}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{truncate(host.id, 12)}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{truncate(host.publicKey, 16)}</td>
                <td className="px-4 py-2 text-muted-foreground">{host.version || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Events Tab ───────────────────────────────────────────────────────────────

function EventsTab({
  events,
  status,
  degraded,
  onClear,
}: {
  events: { event: NetmakerEvent; ts: string }[];
  status: "idle" | "streaming" | "error" | "reconnecting";
  degraded: boolean;
  onClear: () => void;
}) {
  if (degraded) {
    return (
      <div className="rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-6 text-center">
        <AlertTriangle className="h-5 w-5 text-yellow-400 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Event streaming requires the adapter deployed inside the NetMaker container.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            "text-[10px] font-mono",
            status === "streaming" && "border-emerald-500/40 text-emerald-400",
            status === "error" && "border-red-500/40 text-red-400",
            status === "reconnecting" && "border-yellow-500/40 text-yellow-400",
            status === "idle" && "border-border text-muted-foreground",
          )}>
            {status === "streaming" && "● streaming"}
            {status === "error" && "● error"}
            {status === "reconnecting" && "● reconnecting…"}
            {status === "idle" && "○ idle"}
          </Badge>
          <span className="text-xs text-muted-foreground">{events.length} events</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClear} disabled={events.length === 0}>
          Clear
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Waiting for events…
        </div>
      ) : (
        <ScrollArea className="h-[400px] rounded-lg border border-border bg-card">
          <div className="p-2 space-y-1.5">
            {events.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/20">
                <Badge variant="outline" className={cn("text-[10px] font-mono shrink-0 mt-0.5", eventTypeBadgeColor(entry.event.eventType))}>
                  {eventTypeLabel(entry.event.eventType)}
                </Badge>
                <div className="flex-1 min-w-0">
                  <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                    {entry.event.payload ? JSON.stringify(entry.event.payload, null, 2) : "{}"}
                  </pre>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ── CLI Console Tab ──────────────────────────────────────────────────────────

function CliTab({
  commands,
  selectedCommand,
  onSelectCommand,
  params,
  onParamChange,
  onExecute,
  running,
  history,
  degraded,
}: {
  commands: CliCommand[];
  selectedCommand: CliCommand;
  onSelectCommand: (cmd: CliCommand) => void;
  params: Record<string, string>;
  onParamChange: (key: string, value: string) => void;
  onExecute: () => void;
  running: boolean;
  history: { cmd: string; result: ExecuteCommandResponse; ts: string }[];
  degraded: boolean;
}) {
  if (degraded) {
    return (
      <div className="rounded-lg border border-dashed border-yellow-500/40 bg-yellow-500/5 p-6 text-center">
        <AlertTriangle className="h-5 w-5 text-yellow-400 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          CLI execution requires the adapter deployed inside the NetMaker container.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Command form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Execute netclient command</span>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Command</label>
            <select
              value={selectedCommand.id}
              onChange={(e) => {
                const cmd = commands.find((c) => c.id === e.target.value);
                if (cmd) onSelectCommand(cmd);
              }}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs font-mono text-foreground"
            >
              {commands.map((cmd) => (
                <option key={cmd.id} value={cmd.id}>{cmd.label}</option>
              ))}
            </select>
          </div>

          {selectedCommand.params.map((p) => (
            <div key={p.key}>
              <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">{p.label}</label>
              <Input
                value={params[p.key] ?? ""}
                onChange={(e) => onParamChange(p.key, e.target.value)}
                placeholder={p.placeholder}
                className="h-8 w-40 text-xs font-mono"
              />
            </div>
          ))}

          <Button
            size="sm"
            onClick={onExecute}
            disabled={running}
            className="h-8 gap-1.5"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Execute
          </Button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output</h3>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-foreground">$ {entry.cmd}</span>
                    {entry.result.exitCode === 0 ? (
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-400" />
                    )}
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-mono",
                      entry.result.exitCode === 0 ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400",
                    )}>
                      exit {entry.result.exitCode}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(entry.ts).toLocaleTimeString()}</span>
                </div>
                <div className="p-3">
                  {entry.result.stdout && (
                    <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap mb-1">{entry.result.stdout}</pre>
                  )}
                  {entry.result.stderr && (
                    <pre className="text-[11px] font-mono text-red-400 whitespace-pre-wrap">{entry.result.stderr}</pre>
                  )}
                  {!entry.result.stdout && !entry.result.stderr && (
                    <span className="text-[11px] text-muted-foreground italic">No output</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
