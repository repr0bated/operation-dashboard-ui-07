import { useAntigravityChat, type ChatMode } from "@/json-render/stream/use-antigravity-chat";
import type { El } from "./types";

/** Host frame for antigravity.chat — spec children are the repeated chatMessage nodes. */
export const AntigravityChatContainerEl: El<"antigravityChatContainer"> = ({
  props,
  children,
}) => {
  const streamId = props.streamId || "stream_antigravity_01";
  const mode: ChatMode = props.mode === "accountability" ? "accountability" : "live";
  const { input, handleInputChange, handleSubmit, sending } = useAntigravityChat(streamId, mode);

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-[10rem] rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
      {props.title ? (
        <h2 className="text-sm font-medium text-neutral-200 shrink-0">{props.title}</h2>
      ) : null}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0 rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        {children}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          disabled={sending}
          placeholder={props.placeholder ?? "Send antigravity chat…"}
          className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-sky-700 px-4 py-2 text-sm text-white rounded disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
};

export const ChatMessageEl: El<"chatMessage"> = ({ props }) => {
  const { role, content } = props;
  const align =
    role === "user" ? "self-end bg-sky-950/50 border-sky-800" : "self-start bg-neutral-900 border-neutral-800";
  const label = role === "agent" ? "assistant" : role;
  return (
    <div className={`max-w-[80%] rounded-lg border px-3 py-2 ${align}`}>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
      <div className="text-sm text-neutral-100 whitespace-pre-wrap break-words">
        {content || (role === "agent" ? "…" : "")}
      </div>
    </div>
  );
};
