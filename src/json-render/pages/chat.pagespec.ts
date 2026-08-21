import type { Spec } from "@json-render/core";

export const chatSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: { className: "flex flex-col gap-3 h-full min-h-0" },
      children: ["chat-header", "tched-picker", "chat-stack"],
    },
    "chat-stack": {
      type: "splitPane",
      props: { direction: "vertical", className: "flex-1 min-h-0" },
      slots: {
        start: ["antigravity-chat"],
        end: ["accountability-chat"],
      },
    },
    "chat-header": {
      type: "pageHeader",
      props: {
        title: "Antigravity Chat · Accountability",
        subtitle:
          "Stacked panes · live Send on top · ctl_plane_chatbot episodes below · model from tched_router",
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
        title: "Antigravity Chat",
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
    "accountability-chat": {
      type: "antigravityChatContainer",
      props: {
        streamId: "stream_accountability_01",
        title: "Accountability Chat",
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
    "chat-message": {
      type: "chatMessage",
      props: {
        role: { $item: "role" },
        content: { $item: "content" },
      },
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
