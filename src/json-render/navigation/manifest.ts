/**
 * Navigation manifest — single source of truth for sidebar entries.
 *
 * Icons are stored as string keys resolved by `iconRegistry` to keep the
 * manifest serialisable (so it can be shipped alongside JSON specs later).
 * The current `AppShell` iterates this manifest instead of hard-coded
 * arrays; nothing else about the visual layout changed.
 */

import type { Capability } from "./capabilities";

export type NavSection =
  | "Chat"
  | "UI Model"
  | "Control"
  | "Agent"
  | "Infrastructure"
  | "ZeroClaw"
  | "Settings"
  | "Coming Soon"
  | "Blobs";

export interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  section: NavSection;
  order: number;
  requiredCapabilities?: Capability[];
  placeholder?: boolean;
}

export const NAV_MANIFEST: NavItem[] = [
  // Chat
  { id: "chat", label: "Chat", route: "/chat", icon: "MessageSquare", section: "Chat", order: 10 },

  // UI Model
  { id: "gallery", label: "Gallery", route: "/gallery", icon: "Sparkles", section: "UI Model", order: 10 },
  { id: "catalog", label: "Catalog", route: "/catalog", icon: "FileText", section: "UI Model", order: 20 },

  // Control
  { id: "overview", label: "Overview", route: "/", icon: "BarChart3", section: "Control", order: 10 },
  { id: "orchestration", label: "Orchestration", route: "/orchestration", icon: "Orbit", section: "Control", order: 20 },
  { id: "services", label: "Services", route: "/services", icon: "Link2", section: "Control", order: 30 },
  { id: "llm", label: "LLM", route: "/llm", icon: "Radio", section: "Control", order: 40 },

  // Agent
  { id: "agents", label: "Agents", route: "/agents", icon: "Folder", section: "Agent", order: 10 },
  { id: "assistant", label: "Assistant", route: "/assistant", icon: "Bot", section: "Agent", order: 20 },
  { id: "models", label: "Routable Models", route: "/models", icon: "Radio", section: "Agent", order: 30 },
  { id: "tools", label: "Tools", route: "/tools", icon: "Zap", section: "Agent", order: 40 },
  { id: "workflows", label: "Workflows", route: "/workflows", icon: "GitBranch", section: "Agent", order: 50 },
  { id: "security", label: "Security", route: "/security", icon: "Shield", section: "Agent", order: 60 },
  { id: "accountability", label: "Accountability", route: "/accountability", icon: "ScrollText", section: "Agent", order: 70 },
  { id: "skills", label: "Skills", route: "/skills", icon: "ScrollText", section: "Agent", order: 80 },
  { id: "knowledge", label: "Knowledge", route: "/knowledge", icon: "Brain", section: "Agent", order: 90 },
  { id: "embedding", label: "Embedding Pipeline", route: "/embedding", icon: "Orbit", section: "Agent", order: 100 },

  // Infrastructure
  { id: "containers", label: "Containers", route: "/containers", icon: "Box", section: "Infrastructure", order: 10 },
  { id: "privacy-network", label: "Privacy Network", route: "/privacy-network", icon: "Globe", section: "Infrastructure", order: 20 },
  { id: "ovs", label: "Open vSwitch", route: "/ovs", icon: "Network", section: "Infrastructure", order: 30 },
  { id: "openflow", label: "OpenFlow", route: "/openflow", icon: "Workflow", section: "Infrastructure", order: 40 },
  { id: "btrfs", label: "BTRFS Storage", route: "/btrfs", icon: "Monitor", section: "Infrastructure", order: 50 },
  { id: "data-stores", label: "Data Stores", route: "/data-stores", icon: "Monitor", section: "Infrastructure", order: 60 },

  // ZeroClaw
  { id: "gateway", label: "Gateway", route: "/gateway", icon: "Webhook", section: "ZeroClaw", order: 10 },
  { id: "channels", label: "Channels", route: "/channels", icon: "Wifi", section: "ZeroClaw", order: 20 },
  { id: "cron", label: "Cron", route: "/cron", icon: "Clock", section: "ZeroClaw", order: 30 },
  { id: "integrations", label: "Integrations", route: "/integrations", icon: "Puzzle", section: "ZeroClaw", order: 40 },
  { id: "hardware", label: "Hardware", route: "/hardware", icon: "Usb", section: "ZeroClaw", order: 50 },

  // Settings
  { id: "config", label: "Config", route: "/config", icon: "Settings", section: "Settings", order: 10 },
  { id: "inspector", label: "Inspector", route: "/inspector", icon: "Bug", section: "Settings", order: 20 },
  { id: "state", label: "State", route: "/state", icon: "Monitor", section: "Settings", order: 30 },
  { id: "logs", label: "Logs", route: "/logs", icon: "ScrollText", section: "Settings", order: 40 },
  { id: "estop", label: "E-Stop", route: "/estop", icon: "AlertTriangle", section: "Settings", order: 50 },
  { id: "grpc", label: "gRPC Diagnostics", route: "/grpc", icon: "Radio", section: "Settings", order: 60 },
  { id: "explorer", label: "gRPC Explorer", route: "/explorer", icon: "Radio", section: "Settings", order: 70 },
  { id: "invoke", label: "Invoke", route: "/invoke", icon: "Zap", section: "Settings", order: 80 },

  // Coming Soon (placeholders)
  { id: "dreams", label: "Dreams", route: "/dreams", icon: "Moon", section: "Coming Soon", order: 10, placeholder: true },
  { id: "reflections", label: "Reflections", route: "/reflections", icon: "Sparkles", section: "Coming Soon", order: 20, placeholder: true },
  { id: "observability", label: "Observability", route: "/observability", icon: "Eye", section: "Coming Soon", order: 30, placeholder: true },
  { id: "live-trace", label: "Live Trace", route: "/live-trace", icon: "Activity", section: "Coming Soon", order: 40, placeholder: true },

  // Blobs
  { id: "blobs", label: "Sealed Blobs", route: "/blobs", icon: "Package", section: "Blobs", order: 10 },
  { id: "plugins", label: "Plugins", route: "/plugins", icon: "Package", section: "Blobs", order: 20 },
];

export const SECTION_ORDER: NavSection[] = [
  "Chat",
  "UI Model",
  "Control",
  "Agent",
  "Infrastructure",
  "ZeroClaw",
  "Settings",
  "Coming Soon",
  "Blobs",
];

export interface NavGroup {
  section: NavSection;
  items: NavItem[];
}

import { hasAll, type CapabilitySet } from "./capabilities";

/** Filter + group manifest entries into ordered sections. */
export function buildNavGroups(
  manifest: NavItem[],
  caps: CapabilitySet,
): NavGroup[] {
  const bySection = new Map<NavSection, NavItem[]>();
  for (const item of manifest) {
    if (!hasAll(caps, item.requiredCapabilities)) continue;
    const bucket = bySection.get(item.section) ?? [];
    bucket.push(item);
    bySection.set(item.section, bucket);
  }
  return SECTION_ORDER.filter((s) => bySection.has(s)).map((section) => ({
    section,
    items: (bySection.get(section) ?? []).sort((a, b) => a.order - b.order),
  }));
}
