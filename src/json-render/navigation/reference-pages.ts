import type { NavItem } from "./manifest";

const legacyPageSources = import.meta.glob("../../pages/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export interface LegacyPageReference {
  label: string;
  route: string;
  sourcePath: string;
  source: string;
}

export function referencePageFor(item: NavItem | undefined): LegacyPageReference | null {
  if (!item?.referencePage) return null;
  const sourcePath = `src/pages/${item.referencePage}`;
  const source = legacyPageSources[`../../pages/${item.referencePage}`];
  if (typeof source !== "string") {
    throw new Error(`Legacy page reference is missing: ${sourcePath}`);
  }
  return { label: item.label, route: item.route, sourcePath, source };
}

/**
 * Deterministic user prompt for one legacy destination. The JSX is reference
 * material only: the model must rebuild the page from the trusted appCatalog.
 */
export function buildReferencePagePrompt(reference: LegacyPageReference): string {
  return [
    `Render the ${reference.label} system view inside the existing Canvas.`,
    `Use ${reference.sourcePath} below as the sole visual and content reference.`,
    "Do not create an app shell, sidebar, topbar, chatbot, or navigation. The host already provides them.",
    "Return only newline-delimited RFC 6902 SpecStream patches, one complete JSON patch object per line.",
    "Use only components and actions declared by appCatalog.",
    "Preserve the reference page's meaningful heading, subtitle, tabs, cards, tables, empty states, configuration groupings, and information hierarchy.",
    "Use live bindings only when appCatalog and the current store genuinely expose the referenced data. Never invent backend values, health, credentials, counts, successful actions, or tool results.",
    "When live wiring is missing, say so visibly. Do not disguise a static field or local interaction as an operational backend action.",
    "The first visible element must be a prominent REFERENCE MOCK callout explaining that this Canvas is generated from a legacy screen and that values/actions are not live unless explicitly bound.",
    "For configurable domain objects, use Overview and Configuration tabs only when the catalog has a proper configurable component. Treat child objects as domain data derived from the parent plugin, not json-render composition children.",
    "Use a content component such as container as the root. Add /root and its root element early so the Canvas can render progressively.",
    "Do not include markdown fences or explanatory prose outside the patches.",
    "\n--- LEGACY JSX REFERENCE (not executable output) ---\n",
    reference.source,
    "\n--- END LEGACY JSX REFERENCE ---",
  ].join("\n");
}
