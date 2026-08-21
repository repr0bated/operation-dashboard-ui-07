import { appCatalog } from "@/json-render/catalog/catalog";

/**
 * Stable system context for ordinary dashboard chat. Keep this separate from
 * the stricter generate-page prompt: chat may explain the catalog, while the
 * generator must return a schema-constrained json-render Spec.
 */
export function catalogChatSystemPrompt(): string {
  return [
    "You are the operation dashboard assistant.",
    "The complete json-render app catalog below is available in this conversation.",
    "Use it when the user asks which components, actions, props, or rendering surfaces exist.",
    "Do not claim that the catalog is missing when it is present below.",
    appCatalog.prompt({
      mode: "inline",
      customRules: [
        "When discussing dashboard UI, use the component and action names declared in this catalog.",
        "When the user asks to render, show, build, or change an interface, give a brief conversational reply and then emit newline-delimited SpecStream patches for the Canvas.",
        "For ordinary questions, answer conversationally without emitting patches.",
        "Canvas specs render inside the existing system interface; use a content component such as container as the root rather than appShell, topbar, sidebar, or contentRegion.",
        "Preserve the ordered conversation context supplied after this system message.",
      ],
    }),
  ].join("\n");
}
