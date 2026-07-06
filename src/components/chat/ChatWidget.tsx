import { useState, useRef, useEffect, useCallback } from "react";
import { Callout } from "@/components/shell/Primitives";
import { MessageBubble, type LocalMessage } from "@/components/chat/MessageBubble";
import { useEventStore } from "@/stores/event-store";
import { assistantService } from "@/grpc/client";
import { cn } from "@/lib/utils";

/** Coerce arbitrary backend content into a renderable string. */
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

function mapBackendRole(role: string): LocalMessage["role"] {
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") return role;
  return "system";
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ChatWidgetProps {
  agentId?: string;
  initialSessionId?: string;
  className?: string;
  height?: string | number;
}

export function ChatWidget({ agentId = "default", initialSessionId, className, height = 400 }: ChatWidgetProps) {
  const { connected } = useEventStore();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionKey, setSessionKey] = useState<string | null>(initialSessionId || null);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Create session if we don't have one
  useEffect(() => {
    if (!sessionKey) {
      assistantService.createSession({ agentId })
        .then((s) => setSessionKey(s.id))
        .catch((err) => setError(err.message));
    }
  }, [agentId, sessionKey]);

  /** Load history for the active session from the backend. */
  const loadHistory = useCallback(async (sid: string) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const resp = await assistantService.getSessionHistory({ sessionId: sid });
      const mapped: LocalMessage[] = (resp.messages ?? []).map((m, i) => ({
        id: `hist-${sid}-${i}`,
        role: mapBackendRole(m.role),
        content: normalizeContent(m.content),
        timestamp: m.timestamp ? Number(m.timestamp.seconds) * 1000 : Date.now(),
      }));
      setMessages(
        mapped.length > 0
          ? mapped
          : [{ id: makeId("sys"), role: "system", content: `Session "${sid}" ready.`, timestamp: Date.now() }],
      );
    } catch (err) {
      setError((err as Error).message);
      setMessages([{ id: makeId("sys"), role: "system", content: `Failed to load history: ${(err as Error).message}`, timestamp: Date.now() }]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (sessionKey) {
      void loadHistory(sessionKey);
    }
  }, [sessionKey, loadHistory]);

  const handleSend = async () => {
    if (!sessionKey) return;
    const text = draft.trim();
    if (!text || sending) return;

    const userMsg: LocalMessage = {
      id: makeId("msg"),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const resp = await assistantService.sendMessage({
        sessionId: sessionKey,
        content: text
      });
      
      const assistantMsg: LocalMessage = {
        id: makeId("resp"),
        role: "assistant",
        content: normalizeContent(resp.content),
        timestamp: resp.timestamp ? Number(resp.timestamp.seconds) * 1000 : Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { id: makeId("err"), role: "system", content: `Request failed: ${msg}`, timestamp: Date.now() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!sessionKey) {
    return <div className="p-4 text-xs text-muted-foreground animate-pulse">Initializing chat session...</div>;
  }

  return (
    <div className={cn("flex flex-col min-w-0 border border-border rounded-lg bg-card overflow-hidden", className)} style={{ height }}>
      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4" role="log">
        {loadingHistory && (
          <div className="text-xs text-muted-foreground text-center animate-pulse">Loading history…</div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onAction={(action, payload) => {
              const actionMsg: LocalMessage = {
                id: makeId("action"),
                role: "user",
                content: `[Action: ${action}] ${JSON.stringify(payload)}`,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, actionMsg]);
            }}
          />
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">AI</div>
            <div className="rounded-lg bg-card border border-border px-4 py-3 animate-[pulse-dot_1.5s_ease-in-out_infinite]">
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border px-3 py-3 shrink-0 bg-background">
        {error && <Callout variant="danger" className="mb-2">{error}</Callout>}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Send message..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none min-h-[40px] max-h-32 focus:border-ring focus:ring-1 focus:ring-ring outline-none transition-colors font-sans"
              rows={1}
            />
          </div>
          <button onClick={() => void handleSend()} disabled={sending || !draft.trim()} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0 self-end">
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
