/**
 * Dashboard components: layout primitives plus the live Overview widgets.
 *
 * The widgets read the event-stream store internally, which is what lets the
 * Overview page spec stay pure composition. Ported from the previous
 * `catalog/dashboard.tsx`; only the call signature changed.
 */
import { useState } from "react";
import {
  Card,
  StatCard,
  Pill,
  StatusDot,
  Callout,
} from "@/components/shell/Primitives";
import { JsonRenderer } from "@/components/json/JsonRenderer";
import { EventTape } from "@/components/json/EventTape";
import { StateProjectionPanel } from "@/components/json/StateProjectionPanel";
import { ResourceGauge } from "@/components/dashboard/ResourceGauge";
import { EventDistribution } from "@/components/dashboard/EventDistribution";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEventStore } from "@/stores/event-store";
import {
  Activity, Server, Cpu, HardDrive, MemoryStick, Network,
  Layers, Bot, MessageSquare, Shield, Wrench, Clock, ChevronRight, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { El } from "./types";

// ── presentational primitives ────────────────────────────────────────────

export const GridEl: El<"grid"> = ({ props, children }) => {
  const cols = props.cols ?? 2;
  const gap = props.gap ?? 4;
  return (
    <div
      className={cn("grid", props.className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: `${gap * 0.25}rem`,
      }}
    >
      {children}
    </div>
  );
};

export const CardElEl: El<"cardEl"> = ({ props, children }) => (
  <Card
    title={props.title ?? undefined}
    subtitle={props.subtitle ?? undefined}
    className={props.className ?? undefined}
  >
    {children}
  </Card>
);

export const StatCardEl: El<"statCard"> = ({ props }) => (
  <StatCard
    label={props.label}
    value={props.value}
    sub={props.sub ?? undefined}
    variant={props.variant ?? undefined}
  />
);

export const PillEl: El<"pill"> = ({ props }) => (
  <Pill variant={props.variant ?? undefined}>{props.text}</Pill>
);

export const StatusDotEl: El<"statusDot"> = ({ props }) => (
  <StatusDot status={props.status} />
);

export const CalloutEl: El<"callout"> = ({ props, children }) => (
  <Callout variant={props.variant ?? undefined}>{children}</Callout>
);

export const NotesPanelEl: El<"notesPanel"> = ({ props }) => (
  <Card title={props.title ?? "Notes"} subtitle={props.subtitle ?? undefined}>
    <div className="space-y-3 mt-1">
      {props.notes.map((n) => (
        <div key={n.title}>
          <div className="text-xs font-semibold text-foreground">{n.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{n.desc}</div>
        </div>
      ))}
    </div>
  </Card>
);

// ── live Overview widgets ────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export const OverviewHeaderEl: El<"overviewHeader"> = () => {
  const { connected } = useEventStore();
  return (
    <div className="flex items-end justify-between gap-4 px-2 py-1">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight text-foreground">
          Overview
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          System status, resource utilization, and live event stream.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusDot status={connected ? "ok" : "warn"} />
        <span className="text-xs font-mono text-muted-foreground">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </div>
  );
};

export const OverviewLastErrorEl: El<"overviewLastError"> = () => {
  const { lastError } = useEventStore();
  if (!lastError) return null;
  return <Callout variant="danger">{lastError}</Callout>;
};

export const OverviewStatsEl: El<"overviewStats"> = () => {
  const { connected, health } = useEventStore();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label="Status"
        value={
          health?.status === "healthy" ? "Healthy"
          : health?.status === "degraded" ? "Degraded"
          : connected ? "Online" : "Offline"
        }
        variant={health?.status === "healthy" ? "ok" : connected ? "warn" : "danger"}
      />
      <StatCard label="Uptime" value={health?.uptimeMs ? formatUptime(health.uptimeMs) : "—"} />
      <StatCard label="Services" value={health?.services ?? "—"} sub="D-Bus services" />
      <StatCard label="Agents" value={health?.agents ?? "—"} sub="Active workspaces" />
      <StatCard label="Sessions" value={health?.activeSessions ?? "—"} sub="Chat sessions" />
      <StatCard label="Version" value={health?.version ?? "—"} />
    </div>
  );
};

export const ResourcePanelEl: El<"resourcePanel"> = () => {
  const { health, latestStats } = useEventStore();
  // host_runtime.sample_metrics keys latestStats by `${category}.${name}`
  // (see use-event-stream.ts's runMetrics()), each value a
  // {value, unit, labels, timestamp} object — not a flat number under the
  // bare category name.
  const metricValue = (key: string): number | undefined =>
    (latestStats?.[key] as { value?: number } | undefined)?.value;
  const cpu = health?.cpuPercent ?? metricValue("cpu.used_percent") ?? 0;
  const memory = health?.memoryMb
    ? Math.min((health.memoryMb / 2048) * 100, 100)
    : metricValue("memory.used_percent") ?? 0;
  const disk = metricValue("disk.used_percent") ?? 0;
  const networkMbps = metricValue("network.throughput_mbps") ?? 0;
  return (
    <Card
      title="System Resources"
      subtitle="Live resource utilization from the control plane."
      actions={<Cpu className="h-3.5 w-3.5 text-muted-foreground" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
        <ResourceGauge label="CPU" value={cpu} />
        <ResourceGauge label="Memory" value={memory} />
        <ResourceGauge label="Disk" value={disk} />
        <ResourceGauge label="Network" value={Math.min(networkMbps, 100)} unit=" Mbps" variant="default" />
      </div>
      {health?.memoryMb != null && (
        <div className="mt-3 flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" />{health.memoryMb} MB used</span>
          <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />CPU {cpu.toFixed(1)}%</span>
        </div>
      )}
    </Card>
  );
};

export const GatewayAccessEl: El<"gatewayAccess"> = () => (
  <Card title="Gateway Access" subtitle="Connection and authentication details.">
    <div className="space-y-3 mt-1">
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">API Endpoint</span>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/20 text-sm font-mono text-foreground">
          <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{typeof window !== "undefined" ? window.location.origin : ""}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Auth Mode</span>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/20 text-sm font-mono text-foreground">
          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          WireGuard (trusted-proxy)
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-md border border-border bg-[hsl(var(--bg-elevated))] text-xs font-medium hover:bg-muted/30 hover:border-muted-foreground/20 transition-all">
          Refresh
        </button>
        <span className="text-[11px] text-muted-foreground">Authenticated via WireGuard tunnel.</span>
      </div>
    </div>
  </Card>
);

export const ComponentsPanelEl: El<"componentsPanel"> = () => {
  const { connected, health } = useEventStore();
  const items = [
    { name: "D-Bus Monitor", icon: Layers, ok: connected },
    { name: "Agent Runtime", icon: Bot, ok: (health?.agents ?? 0) > 0 },
    { name: "Chat Engine", icon: MessageSquare, ok: connected },
    { name: "Tool Registry", icon: Wrench, ok: connected },
    { name: "SSE Stream", icon: Network, ok: connected },
    { name: "Scheduler", icon: Clock, ok: connected },
  ];
  return (
    <Card
      title="Components"
      subtitle="Subsystem health at a glance."
      actions={<Activity className="h-3.5 w-3.5 text-muted-foreground" />}
    >
      <div className="grid grid-cols-2 gap-2 mt-1">
        {items.map((c) => (
          <div key={c.name} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/10 hover:border-muted-foreground/20 transition-colors">
            <StatusDot status={c.ok ? "ok" : "warn"} />
            <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{c.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const EventDistributionPanelEl: El<"eventDistributionPanel"> = () => {
  const { eventCounts } = useEventStore();
  return (
    <Card
      title="Event Distribution"
      subtitle="SSE event type breakdown from the live stream."
      actions={<Activity className="h-3.5 w-3.5 text-muted-foreground" />}
    >
      {Object.keys(eventCounts).length > 0 ? (
        <EventDistribution counts={eventCounts} className="mt-1" />
      ) : (
        <div className="text-sm text-muted-foreground mt-2 font-mono">
          No events received yet. Connect to the control plane to see live data.
        </div>
      )}
    </Card>
  );
};

interface ConnectedPeer {
  id: string;
  client_id: string;
  type: string;
  protocol: string;
  connected_at: string;
  active_streams: number;
  state?: Record<string, unknown>;
}

export const ConnectedPeersPanelEl: El<"connectedPeersPanel"> = () => {
  const { latestState } = useEventStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const raw =
    latestState["peers"] ?? latestState["peers.connected"] ?? latestState["connected_peers"];
  const peers: ConnectedPeer[] = Array.isArray(raw) ? (raw as ConnectedPeer[]) : [];
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const dur = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };
  const protoColor: Record<string, string> = {
    grpc: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    mcp: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    ws: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    sse: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <Card
      title="Connected Peers"
      subtitle="Active gRPC, MCP, and streaming connections."
      actions={
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px] font-mono">{peers.length} peers</Badge>
        </div>
      }
    >
      {peers.length === 0 ? (
        <div className="text-sm text-muted-foreground mt-2 font-mono">
          No connected peers. Peer data will appear when the control plane reports active connections.
        </div>
      ) : (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="text-[11px]">Client ID</TableHead>
              <TableHead className="text-[11px]">Type</TableHead>
              <TableHead className="text-[11px]">Protocol</TableHead>
              <TableHead className="text-[11px]">Duration</TableHead>
              <TableHead className="text-[11px] text-right">Streams</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {peers.map((peer) => {
              const isOpen = expanded.has(peer.id);
              return (
                <Collapsible key={peer.id} open={isOpen} onOpenChange={() => toggle(peer.id)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/20">
                        <TableCell className="py-2">
                          <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{peer.client_id}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{peer.type}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] font-mono border", protoColor[peer.protocol] ?? "")}>
                            {peer.protocol}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{dur(peer.connected_at)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{peer.active_streams}</TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <div className="px-8 py-3 border-t border-border bg-muted/10">
                            <JsonRenderer data={peer.state ?? { info: "No extended state available" }} defaultMode="tree" />
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};

export const EventTapePanelEl: El<"eventTapePanel"> = () => {
  const { events } = useEventStore();
  return <EventTape events={events} />;
};

export const StateProjectionPanelEl: El<"stateProjectionPanel"> = () => {
  const { latestState } = useEventStore();
  return <StateProjectionPanel state={latestState} />;
};

export const RawStatsPanelEl: El<"rawStatsPanel"> = () => {
  const { latestStats } = useEventStore();
  return latestStats ? (
    <Card title="Raw System Stats" subtitle="Latest system_stats event payload.">
      <JsonRenderer data={latestStats} className="mt-2" />
    </Card>
  ) : (
    <Card title="Raw System Stats" subtitle="Waiting for system_stats events.">
      <div className="text-sm text-muted-foreground mt-2 font-mono">No stats data received.</div>
    </Card>
  );
};
