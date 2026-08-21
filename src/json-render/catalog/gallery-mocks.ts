import { STREAM_CATALOG_NAMES } from "./stream-plugins";
import { ROLE_TO_CATALOG } from "@/json-render/projection/roles";

export const GALLERY_SKIP = new Set<string>([
  "shell",
  "catalogGallery",
  "generateStudio",
  "streamGrid",
  "catalogIndex",
  "streamObject",
  "pluginState",
  "antigravityChatContainer",
  "tchedRouterPicker",
  ...STREAM_CATALOG_NAMES,
]);

export const STREAM_GALLERY_NAMES = [...STREAM_CATALOG_NAMES];

const projectionMocks: Record<string, Record<string, unknown>> = Object.fromEntries(
  Object.entries(ROLE_TO_CATALOG).map(([role, typeName]) => [
    typeName,
    {
      pluginId: "antigravity",
      kind: "field",
      field: "project",
      label: "project",
      subid: `exp.service.antigravity.${role}@v1`,
      role,
    },
  ]),
);

export const galleryMocks: Record<string, Record<string, unknown>> = {
  topbar: {},
  topbarGroup: { align: "start" },
  navToggle: { collapsed: false, expandTitle: "Expand", collapseTitle: "Collapse" },
  brand: { title: "3tched", subtitle: "json-render" },
  navSection: { label: "UI Model", sectionKey: "ui-model", collapsed: false, activeSection: "ui-model" },
  navItemList: {},
  navItem: {
    label: "Gallery demo",
    route: "/gallery",
    icon: "file",
    active: false,
    activeRoute: "/catalog",
    aliases: null,
  },
  pageHeader: {
    title: "Isolated gallery sandbox",
    subtitle: "Mock pageHeader props",
  },
  container: { className: "flex flex-col gap-2" },
  grid: { cols: 2, gap: 8, className: null },
  card: { title: "Gallery card", subtitle: "Mock subtitle", tone: "default", className: null },
  row: { className: null },
  splitPane: { direction: "vertical", className: "min-h-[8rem]" },
  separator: { className: null },
  heading: { text: "Section heading", level: 2 },
  code: { content: '{ "ok": true }' },
  pill: { text: "sealed", tone: "ok" },
  statusDot: { status: "ok" },
  healthPill: { label: "Health", okText: "OK", offlineText: "Offline" },
  callout: { tone: "warn" },
  statusBanner: { title: "Notice", message: "Mock status banner", tone: "warn" },
  emptyState: { title: "Nothing here", hint: "Mock empty state" },
  statCard: { label: "Plugins", value: "66", sub: "sealed", tone: "ok" },
  kv: { label: "schema", value: "antigravity.chat", kind: "string" },
  text: {
    text: "This is a live structural component testing trace block.",
    className: "text-sm text-neutral-300",
  },
  badge: { label: "sealed", tone: "ok" },
  stat: { label: "Plugins", value: "66", unit: "sealed", trend: "flat" },
  stateValue: { path: "tched_router.selected_model", label: "selected_model", format: "raw" },
  chatMessage: {
    role: "agent",
    content: "This is a live structural component testing trace block.",
  },
  ...projectionMocks,
};

export function mockPropsFor(name: string): Record<string, unknown> {
  return galleryMocks[name] ?? {};
}
