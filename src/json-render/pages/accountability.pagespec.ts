import type { Spec } from "@json-render/core";

/**
 * Accountability chat on its own — the counterpart to `antigravitySpec`.
 *
 * Was the bottom pane of `chatSpec`. Split out so `/accountability` stops
 * rendering the live antigravity pane above it.
 */
export const accountabilitySpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-3 h-full min-h-0" },
      children: ["acct-header", "accountability-chat"],
    },
    "acct-header": {
      type: "pageHeader",
      props: {
        title: "Accountability",
        subtitle: "ctl_plane_chatbot reasoning episodes",
      },
    },
    "accountability-chat": {
      type: "antigravityChatContainer",
      props: {
        streamId: "stream_accountability_01",
        title: null,
        mode: "accountability",
        placeholder: "Ask about reasoning episodes…",
      },
      children: ["acct-thread"],
    },
    "acct-thread": {
      type: "container",
      props: { className: "flex flex-col gap-2" },
      repeat: { statePath: "/streams/stream_accountability_01/messages", key: "id" },
      children: ["acct-message"],
    },
    "acct-message": {
      type: "chatMessage",
      props: {
        role: { $item: "role" },
        content: { $item: "content" },
      },
    },
  },
};
