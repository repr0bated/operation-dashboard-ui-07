import { useState, useRef, useEffect, useCallback } from "react";
import { Callout } from "@/components/shell/Primitives";
import { JsonRenderer } from "@/components/json/JsonRenderer";
import { MessageBubble, type LocalMessage } from "@/components/chat/MessageBubble";
import { ProviderSelect } from "@/components/shell/ProviderSelect";
import { ModelSelect } from "@/components/shell/ModelSelect";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import { chatSendRouting } from "@/lib/zeroclaw-routing";
import { useEventStore } from "@/stores/event-store";
import { chatService } from "@/grpc/client";
import { unwrapContentBlocks } from "@/lib/chat-content";
import type { ChatFrame, UIMessagePart } from "@/grpc/gen/chat";
import { UIMessageKind, UIMessageRole } from "@/grpc/gen/chat";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function normalizeContent(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function mapBackendRole(role: UIMessageRole): LocalMessage["role"] {
  switch (role) {
    case UIMessageRole.UI_MESSAGE_ROLE_ASSISTANT:
      return "assistant";
    case UIMessageRole.UI_MESSAGE_ROLE_TOOL:
      return "tool";
    default:
      return "system";
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Home surface: chat and nothing else. */
export default function ChatOnlyPage() {
  const { connected } = useEventStore();
  const routing = useZeroclawRouting();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionKey, setSessionKey] = useState("default");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<{ abort: () => void } | null>(null);

  const scrollToBottom = useCallback(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const resetThread = useCallback((sid: string) => {
    streamRef.current?.abort();
    streamRef.current = null;
    setMessages([
      { id: makeId("sys"), role: "system", content: `Conversation "${sid}" ready.`, timestamp: Date.now() },
    ]);
  }, []);

  useEffect(() => { resetThread(sessionKey); }, [sessionKey, resetThread]);
  useEffect(() => () => streamRef.current?.abort(), []);

  const openInSidebar = useCallback((payload: unknown) => {
    setSidebarContent(payload);
    setSidebarOpen(true);
  }, []);

  const handleNewSession = () => setSessionKey(`session-${Date.now().toString(36)}`);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setMessages((prev) => [
      ...prev,
      { id: makeId("msg"), role: "user", content: text, timestamp: Date.now() },
    ]);
    setDraft("");
    setSending(true);
    setError(null);
    streamRef.current?.abort();

    const { provider, model } = chatSendRouting(routing.state);
    const { stream, abort } = chatService.send({
      conversationId: sessionKey,
      content: text,
      provider,
      model,
    });
    streamRef.current = { abort };

    try {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const frame = value as ChatFrame;
        const payload = frame.payload;
        if (!payload) continue;

        if (payload.oneofKind === "message") {
          const msg = payload.message;
          const parts: UIMessagePart[] = msg.parts ?? [];
          const content = normalizeContent(unwrapContentBlocks(parts));
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id || makeId("res"),
              role: mapBackendRole(msg.role),
              content,
              timestamp: Date.now(),
              kind: msg.kind === UIMessageKind.UI_MESSAGE_KIND_TOOL_RESULT ? "tool-result" : undefined,
              raw: parts,
            },
          ]);
        } else if (payload.oneofKind === "error") {
          setError(payload.error.message || "Stream error");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
      streamRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-2 shrink-0">
        <ProviderSelect />
        <ModelSelect />
        <input
          value={sessionKey}
          onChange={(e) => setSessionKey(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-input bg-card text-sm font-mono focus:border-ring outline-none w-56"
          placeholder="session id"
        />
      </div>

      <div className={cn("flex flex-1 min-h-0")}>
        <div className={cn("flex flex-col flex-1 min-w-0", sidebarOpen && "flex-[0_0_60%]")}>
          <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" role="log">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onInspect={openInSidebar} />
            ))}
            {sending && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">AI</div>
                <div className="rounded-lg bg-card border border-border px-4 py-3">
                  <span className="text-sm text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-3 shrink-0 bg-background">
            {error && <Callout variant="danger" className="mb-3">{error}</Callout>}
            {!connected && !error && (
              <Callout variant="default" className="mb-3">
                Event stream is idle — chat still works through the gateway.
              </Callout>
            )}
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="Message (↩ to send, Shift+↩ for line breaks)"
                className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-card text-sm resize-none min-h-[44px] max-h-40 focus:border-ring focus:ring-1 focus:ring-ring outline-none transition-colors font-sans"
                rows={1}
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={handleNewSession} className="px-3 py-2 rounded-md border border-border bg-[hsl(var(--bg-elevated))] text-xs font-medium hover:bg-muted/30 transition-colors">
                  New session
                </button>
                <button onClick={() => void handleSend()} disabled={sending || !draft.trim()} className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {sending ? "Sending" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <div className="flex-[0_0_40%] border-l border-border bg-card flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inspector</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-muted/30 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {sidebarContent !== null ? (
                <JsonRenderer data={sidebarContent} />
              ) : (
                <div className="text-sm text-muted-foreground">Click a tool result to inspect.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
