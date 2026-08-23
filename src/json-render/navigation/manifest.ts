/**
 * Navigation manifest — the single, serialisable source of truth for both the
 * legacy shell and the compact system-view menu above Antigravity chat.
 */
import type { Capability } from "./capabilities";

export const SECTION_ORDER = [
  "Chat",
  "UI Model",
  "Control",
  "Agent",
  "Infrastructure",
  "ZeroClaw",
  "Settings",
  "Blobs",
  "Plugins",
  "Coming Soon",
] as const;

export type NavSection = (typeof SECTION_ORDER)[number];

export interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  section: NavSection;
  order: number;
  requiredCapabilities?: Capability[];
  placeholder?: boolean;
  wip?: boolean;
  wipReason?: string;
  aliases?: string[];
  /** A single legacy JSX file used as a reference by the Canvas generator. */
  referencePage?: string;
}

const item = (
  id: string,
  label: string,
  route: string,
  icon: string,
  section: NavSection,
  order: number,
  options: Partial<Pick<NavItem, "aliases" | "placeholder" | "referencePage" | "wip" | "wipReason">> = {},
): NavItem => ({ id, label, route, icon, section, order, ...options });

export const NAV_MANIFEST: NavItem[] = [
  item("chat", "Chat", "/antigravity/chat", "MessageSquare", "Chat", 10, {
    aliases: ["/chat", "/antigravity"],
  }),
  item("accountability", "Accountability", "/accountability", "ScrollText", "Chat", 20),

  item("catalog", "Catalog", "/catalog", "FileText", "UI Model", 10),
  item("gallery", "Gallery", "/gallery", "Sparkles", "UI Model", 20),
  item("generate", "Generate", "/generate", "Zap", "UI Model", 30),
  item("antigravity-llm", "Antigravity LLM", "/antigravity-llm", "Bot", "UI Model", 40, { referencePage: "AntiqravityLLMPage.tsx" }),

  item("overview", "Overview", "/overview", "BarChart3", "Control", 10, { aliases: ["/"] }),
  item("orchestration", "Orchestration", "/orchestration", "Orbit", "Control", 20, { referencePage: "OrchestrationPage.tsx" }),
  item("services", "Services", "/services", "Link2", "Control", 30, { referencePage: "ServicesPage.tsx" }),
  item("llm", "LLM", "/llm", "Radio", "Control", 40, { referencePage: "LlmPage.tsx" }),

  item("agents", "Agents", "/agents", "Bot", "Agent", 10),
  item("assistant", "Assistant", "/assistant", "Bot", "Agent", 20, { referencePage: "AssistantPage.tsx" }),
  item("models", "Routable Models", "/models", "Radio", "Agent", 30, { referencePage: "RoutableModelsPage.tsx" }),
  item("tools", "Tools", "/tools", "Zap", "Agent", 40, { referencePage: "ToolsPage.tsx" }),
  item("workflows", "Workflows", "/workflows", "GitBranch", "Agent", 50, { referencePage: "WorkflowsPage.tsx" }),
  item("security", "Security", "/security", "Shield", "Agent", 60, { referencePage: "SecurityPage.tsx" }),
  item("skills", "Skills", "/skills", "ScrollText", "Agent", 70, { referencePage: "SkillsPage.tsx" }),
  item("knowledge", "Knowledge", "/knowledge", "Brain", "Agent", 80, { referencePage: "KnowledgePage.tsx" }),
  item("embedding", "Embedding Pipeline", "/embedding", "Orbit", "Agent", 90, { referencePage: "EmbeddingPipelinePage.tsx" }),

  item("containers", "Containers", "/containers", "Box", "Infrastructure", 10, { referencePage: "ContainersPage.tsx" }),
  item("privacy-network", "Privacy Network", "/privacy-network", "Globe", "Infrastructure", 20, { referencePage: "PrivacyNetworkPage.tsx" }),
  item("netmaker", "Network Control", "/netmaker", "Network", "Infrastructure", 30, {
    aliases: ["/network"],
    referencePage: "NetmakerPage.tsx",
  }),
  item("ovs", "Open vSwitch", "/ovs", "Network", "Infrastructure", 40, { referencePage: "OpenSwitchPage.tsx" }),
  item("openflow", "OpenFlow", "/openflow", "Workflow", "Infrastructure", 50, { referencePage: "OpenFlowPage.tsx" }),
  item("btrfs", "BTRFS Storage", "/btrfs", "Monitor", "Infrastructure", 60, { referencePage: "BtrfsPage.tsx" }),
  item("data-stores", "Data Stores", "/data-stores", "Monitor", "Infrastructure", 70, { referencePage: "DataStoresPage.tsx" }),

  item("tched-router-config", "3tched Config", "/tched-router/config", "Settings", "ZeroClaw", 5),
  item("gateway", "Gateway", "/gateway", "Webhook", "ZeroClaw", 10, {
    referencePage: "GatewayPage.tsx",
    wip: true,
    wipReason: "Gateway lifecycle, webhook, and websocket controls are not wired to the live backend yet.",
  }),
  item("channels", "Channels", "/channels", "Wifi", "ZeroClaw", 20, {
    referencePage: "ChannelsPage.tsx",
    wip: true,
    wipReason: "Channel availability and configuration are static references without live backend wiring.",
  }),
  item("cron", "Cron", "/cron", "Clock", "ZeroClaw", 30, {
    referencePage: "CronPage.tsx",
    wip: true,
    wipReason: "Scheduled-task listing and mutation controls are not connected to the live scheduler yet.",
  }),
  item("integrations", "Integrations", "/integrations", "Puzzle", "ZeroClaw", 40, {
    referencePage: "IntegrationsPage.tsx",
    wip: true,
    wipReason: "Integration inventory and install actions are reference-only and not connected to a backend.",
  }),
  item("hardware", "Hardware", "/hardware", "Usb", "ZeroClaw", 50, {
    referencePage: "HardwarePage.tsx",
    wip: true,
    wipReason: "Hardware discovery and scan actions are not connected to the live device service yet.",
  }),

  item("config", "Config", "/config", "Settings", "Settings", 10, { referencePage: "ConfigPage.tsx" }),
  item("inspector", "Inspector", "/inspector", "Bug", "Settings", 20, { referencePage: "InspectorPage.tsx" }),
  item("state", "State", "/state", "Monitor", "Settings", 30, { referencePage: "StatePage.tsx" }),
  item("logs", "Logs", "/logs", "ScrollText", "Settings", 40, { referencePage: "LogsPage.tsx" }),
  item("estop", "E-Stop", "/estop", "AlertTriangle", "Settings", 50, {
    referencePage: "EStopPage.tsx",
    wip: true,
    wipReason: "Emergency-stop status and mutation controls are not wired to the live safety backend yet.",
  }),
  item("grpc", "gRPC Diagnostics", "/grpc", "Radio", "Settings", 60, { referencePage: "GrpcDiagnosticsPage.tsx" }),
  item("explorer", "gRPC Explorer", "/explorer", "Radio", "Settings", 70, { referencePage: "GrpcExplorerPage.tsx" }),
  item("invoke", "Invoke", "/invoke", "Play", "Settings", 80, { referencePage: "InvokePage.tsx" }),

  item("blobs", "Sealed Blobs", "/blobs", "Package", "Blobs", 10, { referencePage: "BlobsPage.tsx" }),

  // Native StateSync stream browser. This remains an instant json-render spec,
  // not a model-generated legacy reference.
  item("plugins", "Stream", "/plugins", "Package", "Plugins", 10),

  item("dreams", "Dreams", "/dreams", "Moon", "Coming Soon", 10, { placeholder: true }),
  item("reflections", "Reflections", "/reflections", "Sparkles", "Coming Soon", 20, { placeholder: true }),
  item("observability", "Observability", "/observability", "Eye", "Coming Soon", 30, { placeholder: true }),
  item("live-trace", "Live Trace", "/live-trace", "Activity", "Coming Soon", 40, { placeholder: true }),
];

export interface NavGroup {
  section: NavSection;
  items: NavItem[];
}

import { hasAll, type CapabilitySet } from "./capabilities";

export function sectionSlug(section: NavSection | string): string {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function activeSectionSlug(
  route: string,
  manifest: NavItem[] = NAV_MANIFEST,
): string {
  const exact = manifest.find(
    (entry) => entry.route === route || entry.aliases?.includes(route),
  );
  if (exact) return sectionSlug(exact.section);
  const prefixed = manifest.find(
    (entry) => entry.route !== "/" && route.startsWith(entry.route),
  );
  return prefixed ? sectionSlug(prefixed.section) : "";
}

export function buildNavGroups(
  manifest: NavItem[],
  caps: CapabilitySet,
): NavGroup[] {
  const bySection = new Map<NavSection, NavItem[]>();
  for (const entry of manifest) {
    if (!hasAll(caps, entry.requiredCapabilities)) continue;
    const bucket = bySection.get(entry.section) ?? [];
    bucket.push(entry);
    bySection.set(entry.section, bucket);
  }
  return SECTION_ORDER.filter((section) => bySection.has(section)).map((section) => ({
    section,
    items: (bySection.get(section) ?? []).sort((a, b) => a.order - b.order),
  }));
}
