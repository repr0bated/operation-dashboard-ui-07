import type { Spec, UIElement } from "@json-render/core";

export interface ReferenceMockDef {
  route: string;
  title: string;
  subtitle: string;
  notes: { title: string; desc: string }[];
}

export function hostedPageSpec(route: string): Spec {
  const id = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page";
  return {
    root: id,
    elements: {
      [id]: {
        type: "hostedPage",
        props: { route },
      },
    },
  };
}

export function referenceMockSpec(def: ReferenceMockDef): Spec {
  const id = def.route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page";
  const elements: Record<string, UIElement> = {
    [id]: {
      type: "container",
      props: { className: "flex flex-col gap-4" },
      children: [`${id}-banner`, `${id}-header`, `${id}-notes`, `${id}-empty`],
    },
    [`${id}-banner`]: {
      type: "statusBanner",
      props: {
        title: "REFERENCE MOCK",
        message:
          "Rebuilt from the legacy JSX screen. Values and actions are not live unless a catalog widget binds StateSync.",
        tone: "warn",
      },
    },
    [`${id}-header`]: {
      type: "pageHeader",
      props: { title: def.title, subtitle: def.subtitle },
    },
    [`${id}-notes`]: {
      type: "notesPanel",
      props: {
        title: "From the reference screen",
        subtitle: def.route,
        notes: def.notes,
      },
    },
    [`${id}-empty`]: {
      type: "emptyState",
      props: {
        title: "No live binding on this surface",
        hint: "Use D-Bus PluginV1.Call / tonic :8090 for operational data. This page is a catalog mock of the old JSX.",
      },
    },
  };
  return { root: id, elements };
}

/** Every NAV_MANIFEST referencePage that did not already have a hand-written spec. */
export const REFERENCE_MOCK_DEFS: ReferenceMockDef[] = [
  {
    route: "/antigravity-llm",
    title: "Antigravity LLM",
    subtitle: "UI routes from Antigravity's sealed plugin projection.",
    notes: [
      { title: "Projection", desc: "Routes come from the Antigravity sealed blob, not a local model list." },
      { title: "Chat", desc: "Operator chat stays on /antigravity/chat." },
    ],
  },
  {
    route: "/orchestration",
    title: "Orchestration",
    subtitle: "Multi-agent execution monitoring and coordination control.",
    notes: [
      { title: "Execution graph", desc: "Strategy and live TaskResult feed from the orchestrator." },
      { title: "Task ledger", desc: "Reference screen listed active tasks; no live bind here." },
    ],
  },
  {
    route: "/services",
    title: "Services",
    subtitle: "Service manager control center — monitor, inspect, and manage supervised services.",
    notes: [
      { title: "runit", desc: "Host services are runit units, not systemd." },
      { title: "Inspect", desc: "Status and logs belong on the D-Bus / tonic door." },
    ],
  },
  {
    route: "/llm",
    title: "LLM",
    subtitle: "Provider status, available models, and routing.",
    notes: [
      { title: "Router", desc: "Selection is tched_router SetSelection on the bus." },
      { title: "Providers", desc: "Live list is ListModels, not this mock." },
    ],
  },
  {
    route: "/assistant",
    title: "Assistant",
    subtitle: "Config for the chatbot account — system prompt, providers, souls, and namespaces.",
    notes: [
      { title: "Account", desc: "Chatbot identity and souls from the assistant plugin." },
      { title: "Namespaces", desc: "Memory namespaces are cognitive_mcp on the session bus." },
    ],
  },
  {
    route: "/models",
    title: "Routable Models",
    subtitle: "LLM gateway model routing, read live from the control plane.",
    notes: [
      { title: "Providers", desc: "Registered gateway families and their model lists." },
      { title: "Selection", desc: "Picking a model is a tched_router mutation." },
    ],
  },
  {
    route: "/tools",
    title: "Tools",
    subtitle: "Searchable tool catalog with schema-first execution.",
    notes: [
      { title: "Catalog", desc: "Tools are PluginV1.Call surfaces, not HTTP MCP :11436." },
      { title: "Execute", desc: "The JSX execute pane was a simulated result." },
    ],
  },
  {
    route: "/workflows",
    title: "Workflows",
    subtitle: "Visual workflow builder with schema-driven tool nodes.",
    notes: [
      { title: "Builder", desc: "Nodes are schema methods, not free-form steps." },
      { title: "Run", desc: "Execution is a control-plane mutation when wired." },
    ],
  },
  {
    route: "/security",
    title: "Security & Audit",
    subtitle: "Cryptographic audit trail with semantic search.",
    notes: [
      { title: "Event chain", desc: "Audit blocks live on the bridge event chain." },
      { title: "Auth / TLS", desc: "Ghostbridge headers on the tonic door." },
    ],
  },
  {
    route: "/skills",
    title: "Cognitive Skills",
    subtitle: "Browse, configure, and test domain-specific knowledge augmentations.",
    notes: [
      { title: "Skills", desc: "Loaded from the router workspace skill bundles." },
      { title: "Review", desc: "Post-turn skill_improvement is a zeroclaw fork, not this page." },
    ],
  },
  {
    route: "/knowledge",
    title: "Knowledge",
    subtitle: "Notebooks, corpora, and retrieval sources for the cognitive store.",
    notes: [
      { title: "Store", desc: "Bridge-owned Cozo at memory.db — do not start op-cognitive-mcp." },
      { title: "Search", desc: "code_search / memory_query via zcall cognitive_mcp." },
    ],
  },
  {
    route: "/embedding",
    title: "Embedding Pipeline",
    subtitle: "Voyage / Qdrant embedding jobs and collection health.",
    notes: [
      { title: "Shuttle", desc: "QdrantSemanticShuttle is attached on the bridge." },
      { title: "Model", desc: "Embedding model is a plugin, not a local HTTP service." },
    ],
  },
  {
    route: "/containers",
    title: "Incus Containers",
    subtitle: "Manage system and user LXD/Incus instances.",
    notes: [
      { title: "No NIC", desc: "Containers talk UDS on container.sock, not a veth." },
      { title: "Autostart", desc: "runit incus-ct-* units own boot, not Incus autostart." },
    ],
  },
  {
    route: "/privacy-network",
    title: "Privacy Network",
    subtitle: "Real-time topology of the privacy routing stack.",
    notes: [
      { title: "Egress", desc: "WARP / wgcf-egress is the privacy hop." },
      { title: "Identity", desc: "Ghostbridge footprint is stamped at ingress." },
    ],
  },
  {
    route: "/netmaker",
    title: "Network Control",
    subtitle: "Netmaker mesh, peers, and host netclient.",
    notes: [
      { title: "OVS", desc: "netmaker is an ovsbr0 port via add-port." },
      { title: "API", desc: "Control plane is loopback + UDS, not a public port." },
    ],
  },
  {
    route: "/ovs",
    title: "Open vSwitch",
    subtitle: "OVS bridges, ports, and virtual networking.",
    notes: [
      { title: "Bridge", desc: "ovsbr0 is the fabric switch." },
      { title: "Control", desc: "Use D-Bus rovs / openflow plugins, not ovs-vsctl from the UI." },
    ],
  },
  {
    route: "/openflow",
    title: "OpenFlow",
    subtitle: "Flow table explorer and rule management.",
    notes: [
      { title: "Controller", desc: "op-of-controller listens on 10.200.0.1:6653." },
      { title: "Flows", desc: "add_flow is a plugin method on the bus." },
    ],
  },
  {
    route: "/btrfs",
    title: "BTRFS Storage",
    subtitle: "Subvolumes, snapshots, and pool layout.",
    notes: [
      { title: "Pools", desc: "3tched-storage and golden/live publish path." },
      { title: "Timing", desc: "Audit timing trail is its own subvolume." },
    ],
  },
  {
    route: "/data-stores",
    title: "Data Stores",
    subtitle: "Cozo, Qdrant, and other persistence endpoints.",
    notes: [
      { title: "Cozo", desc: "Bridge owns cognitive memory.db and identity-cozo." },
      { title: "Qdrant", desc: "gRPC via UDS relay, not a host NIC." },
    ],
  },
  {
    route: "/gateway",
    title: "Gateway",
    subtitle: "Manage webhooks, websockets, and gateway server settings.",
    notes: [
      { title: "Status", desc: "Reference screen showed Stopped / coming soon." },
      { title: "Door", desc: "Public traffic enters tonic :8090, not a separate gateway UI." },
    ],
  },
  {
    route: "/channels",
    title: "Channels",
    subtitle: "Telegram, Slack, Discord, and other inbound channels.",
    notes: [
      { title: "Config", desc: "Channel tables live in zeroclaw config, not this mock." },
      { title: "Live", desc: "No backend wiring on the reference screen." },
    ],
  },
  {
    route: "/cron",
    title: "Scheduled Tasks",
    subtitle: "Cron jobs owned by the router scheduler.",
    notes: [
      { title: "Jobs", desc: "cron plugin methods exist on the bus when granted." },
      { title: "UI", desc: "Reference listing was static." },
    ],
  },
  {
    route: "/integrations",
    title: "Integrations",
    subtitle: "Optional third-party connectors.",
    notes: [
      { title: "Inventory", desc: "Reference-only install list." },
      { title: "Opt-in", desc: "Most integrations stay disabled until configured." },
    ],
  },
  {
    route: "/hardware",
    title: "Hardware",
    subtitle: "USB and peripheral discovery.",
    notes: [
      { title: "Scan", desc: "Reference screen had no live device service." },
      { title: "Peripherals", desc: "Boards become tools only when enabled in config." },
    ],
  },
  {
    route: "/config",
    title: "Config",
    subtitle: "Edit control plane configuration safely.",
    notes: [
      { title: "3tched Config", desc: "Prefer /tched-router/config for the live schema editor." },
      { title: "MCP", desc: "mcp / mcp_bundles are hidden — HTTP MCP client is off." },
    ],
  },
  {
    route: "/inspector",
    title: "D-Bus Inspector",
    subtitle: "Hierarchical object browser with method execution.",
    notes: [
      { title: "Bus", desc: "unix:path=/run/opdbus/session-bus.sock org.opdbus.v1.plugins." },
      { title: "Call", desc: "PluginV1.Call is the only mutation door." },
    ],
  },
  {
    route: "/state",
    title: "Live State",
    subtitle: "Interactive state projections grouped by plugin.",
    notes: [
      { title: "Projection", desc: "SHM / StateSync objects, not a second store." },
      { title: "Tunables", desc: "Writes go through apply_state / Call." },
    ],
  },
  {
    route: "/logs",
    title: "Logs",
    subtitle: "Live EventChain stream via EventChainService.SubscribeEvents.",
    notes: [
      { title: "Subscribe", desc: "tonic EventChain on :8090 / grpc.sock." },
      { title: "Files", desc: "svlogd under /var/log/op-dbus/." },
    ],
  },
  {
    route: "/estop",
    title: "Emergency Stop",
    subtitle: "Safety interlock status and engage/resume.",
    notes: [
      { title: "State", desc: "Reference screen was not wired to the live safety backend." },
      { title: "CLI", desc: "zeroclaw estop remains the operator tool." },
    ],
  },
  {
    route: "/grpc",
    title: "gRPC Diagnostics",
    subtitle: "Reflection, health, and per-plugin method probes on the tonic door.",
    notes: [
      { title: "Door", desc: "127.0.0.1:8090 TLS demux + /run/opdbus/grpc.sock." },
      { title: "Identity", desc: "Calls need Ghostbridge footprint headers." },
    ],
  },
  {
    route: "/explorer",
    title: "gRPC Explorer",
    subtitle: "Invoke server-streaming methods and render projected frames.",
    notes: [
      { title: "Streaming", desc: "StateSync and watch RPCs on the same door." },
      { title: "Frames", desc: "Projected JSON, not raw protobuf in the mock." },
    ],
  },
  {
    route: "/invoke",
    title: "Invoke",
    subtitle: "Pick a plugin method and Call it with JSON args.",
    notes: [
      { title: "zcall", desc: "Same contract as zcall <plugin> <method>." },
      { title: "Caps", desc: "Access denied means the grant is missing." },
    ],
  },
  {
    route: "/blobs",
    title: "Sealed Blobs",
    subtitle: "Plugin catalog in /dev/shm/opdbus/plugin-blobs.",
    notes: [
      { title: "Catalog", desc: "A plugin exists iff its blob is sealed." },
      { title: "Read", desc: "opblob / schema_renderer — never re-hash." },
    ],
  },
  {
    route: "/dreams",
    title: "Dreams",
    subtitle: "Offline consolidation of session memory.",
    notes: [{ title: "Coming soon", desc: "Placeholder — no live plugin surface yet." }],
  },
  {
    route: "/reflections",
    title: "Reflections",
    subtitle: "Post-session review artifacts.",
    notes: [{ title: "Coming soon", desc: "Placeholder — no live plugin surface yet." }],
  },
  {
    route: "/observability",
    title: "Observability",
    subtitle: "Metrics, traces, and control-plane health.",
    notes: [{ title: "Coming soon", desc: "Use Logs and gRPC Diagnostics until this surface exists." }],
  },
  {
    route: "/live-trace",
    title: "Live Trace",
    subtitle: "Streaming turn traces from the selected model.",
    notes: [{ title: "Coming soon", desc: "Runtime traces stay in zeroclaw data/state until wired." }],
  },
];

const COMING_SOON = new Set(["/dreams", "/reflections", "/observability", "/live-trace"]);

export const REFERENCE_MOCK_SPECS: Record<string, Spec> = Object.fromEntries(
  REFERENCE_MOCK_DEFS.map((def) => [
    def.route,
    COMING_SOON.has(def.route) ? referenceMockSpec(def) : hostedPageSpec(def.route),
  ]),
);
