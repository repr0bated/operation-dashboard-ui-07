/**
 * Chat-only surface — the antigravity chat with no shell chrome.
 *
 * Same spec (`antigravitySpec`) and the same `stream_antigravity_01` uiStore
 * thread the `/chat` page renders, so a conversation is identical either way.
 * What is dropped is the shell: no sidebar, no nav, no topbar. This is the
 * surface to embed, to open on a second screen, or to hand to the model as the
 * thing it renders UI into.
 *
 * `useEventStream()` is called here because `ShellRoutes` normally owns it —
 * without the shell nothing else opens the StateSync subscription, and the
 * catalog components the chat renders read from that store.
 */
import { Renderer } from "@json-render/react";
import { JsonRenderProvider, useJsonRender } from "@/json-render/runtime/JsonRenderProvider";
import { antigravitySpec } from "@/json-render/pages";
import { useEventStream } from "@/json-render/stream/use-event-stream";

function ChatOnlySurface() {
  const { registry } = useJsonRender();
  return (
    <main className="h-screen w-screen overflow-hidden bg-background p-3">
      <Renderer key="chat-only" spec={antigravitySpec} registry={registry} />
    </main>
  );
}

export default function ChatOnlyPage() {
  useEventStream();
  return (
    <JsonRenderProvider>
      <ChatOnlySurface />
    </JsonRenderProvider>
  );
}
