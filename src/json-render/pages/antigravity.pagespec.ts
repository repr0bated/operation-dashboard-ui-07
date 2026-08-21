import type { Spec } from "@json-render/core";

/**
 * Antigravity chat on its own — no accountability pane.
 *
 * `chatSpec` stacks this pane over the accountability pane in one splitPane;
 * this spec is that top pane alone, so the chat gets the full content height.
 * Same streamId (`stream_antigravity_01`) and `mode: "live"`, so the thread is
 * the same uiStore state either page renders it from.
 */
export const antigravitySpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-3 h-full min-h-0" },
      children: ["chat-header", "tched-picker", "antigravity-chat"],
    },
    "chat-header": {
      type: "pageHeader",
      props: {
        title: "Antigravity Chat",
        subtitle: "Live chat · model from tched_router",
      },
    },
    "tched-picker": {
      type: "tchedRouterPicker",
      props: { className: null },
    },
    "antigravity-chat": {
      type: "antigravityChatContainer",
      props: {
        streamId: "stream_antigravity_01",
        // pageHeader already names the pane; a second heading would repeat it.
        title: null,
        mode: "live",
        placeholder: "Send antigravity chat…",
      },
      children: ["chat-thread"],
    },
    "chat-thread": {
      type: "container",
      props: { className: "flex flex-col gap-2" },
      repeat: { statePath: "/streams/stream_antigravity_01/messages", key: "id" },
      children: ["chat-message"],
    },
    "chat-message": {
      type: "chatMessage",
      props: {
        role: { $item: "role" },
        content: { $item: "content" },
      },
    },
  },
};
