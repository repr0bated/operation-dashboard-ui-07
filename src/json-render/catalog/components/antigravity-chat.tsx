import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { Renderer } from "@json-render/react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAntigravityChat, type ChatMode } from "@/json-render/stream/use-antigravity-chat";
import { pageSpecFor } from "@/json-render/pages";
import { useJsonRender } from "@/json-render/runtime/JsonRenderProvider";
import { WorkspaceNavigation } from "@/json-render/navigation/workspace-navigation";
import { referencePageFor } from "@/json-render/navigation/reference-pages";
import { useReferencePageSpec } from "@/json-render/generate/use-reference-page-spec";
import { GeneratedSpecRenderer } from "@/json-render/runtime/GeneratedSpecRenderer";
import type { El } from "./types";

const CHAT_HOME_ROUTES = new Set(["/antigravity/chat", "/antigravity", "/chat"]);

function initialWorkspaceRoute(pathname: string, groups: ReturnType<typeof useJsonRender>["navGroups"]): string | null {
  if (CHAT_HOME_ROUTES.has(pathname)) return null;
  if (pathname === "/" || pathname === "/chat-only") return "/overview";
  const match = groups
    .flatMap((group) => group.items)
    .find((item) => item.route === pathname || item.aliases?.includes(pathname));
  return match && !match.placeholder ? match.route : "/overview";
}

class WorkspaceBoundary extends Component<
  { children: ReactNode; revision: number },
  { error: string | null }
> {
  constructor(props: { children: ReactNode; revision: number }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[system-workspace]", error, info.componentStack);
  }
  componentDidUpdate(previous: { children: ReactNode; revision: number }) {
    if (this.state.error && previous.revision !== this.props.revision) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return <p className="text-xs font-mono text-red-400">{this.state.error}</p>;
    }
    return this.props.children;
  }
}

/** Host frame for antigravity.chat — spec children are the repeated chatMessage nodes. */
export const AntigravityChatContainerEl: El<"antigravityChatContainer"> = ({
  props,
  children,
}) => {
  const streamId = props.streamId || "stream_antigravity_01";
  const mode: ChatMode = props.mode === "accountability" ? "accountability" : "live";
  const showWorkspace = mode === "live" && props.workspace !== false;
  const {
    input,
    handleInputChange,
    handleSubmit,
    sending: chatSending,
    canvasSpec,
  } = useAntigravityChat(streamId, mode);
  const { registry, navGroups } = useJsonRender();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // The first authenticated view is the operational Overview. Selecting Chat
  // returns to the freeform Canvas; generated chat specs also take focus there.
  const [workspaceRoute, setWorkspaceRoute] = useState<string | null>(() =>
    initialWorkspaceRoute(pathname, navGroups),
  );
  const workspaceItem = useMemo(
    () => navGroups.flatMap((group) => group.items).find((item) => item.route === workspaceRoute),
    [navGroups, workspaceRoute],
  );
  const pageReference = useMemo(() => referencePageFor(workspaceItem), [workspaceItem]);
  const referencePage = useReferencePageSpec(pageReference);
  const workspaceSpec = pageReference
    ? referencePage.spec
    : workspaceRoute
      ? pageSpecFor(workspaceRoute) ?? null
      : canvasSpec;

  useEffect(() => {
    if (showWorkspace && canvasSpec) {
      setWorkspaceRoute(null);
      if (!CHAT_HOME_ROUTES.has(pathname)) navigate("/antigravity/chat", { replace: true });
    }
    // Only a newly produced Canvas spec takes focus. Route changes must not
    // re-focus an older conversational spec over a selected system view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSpec]);

  useEffect(() => {
    if (!showWorkspace) return;
    setWorkspaceRoute(initialWorkspaceRoute(pathname, navGroups));
  }, [pathname, navGroups, showWorkspace]);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {showWorkspace ? (
        <WorkspaceNavigation
          groups={navGroups}
          selectedRoute={workspaceRoute ?? "/antigravity/chat"}
          onSelect={(item) => {
            const next = CHAT_HOME_ROUTES.has(item.route) ? null : item.route;
            setWorkspaceRoute(next);
            navigate(item.route);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-2 flex-[1_1_0%] min-h-[8rem] rounded-lg border border-neutral-800 bg-neutral-950/30 p-3">
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
            disabled={chatSending}
            placeholder={props.placeholder ?? "Send antigravity chat…"}
            className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={chatSending || !input.trim()}
            className="bg-sky-700 px-4 py-2 text-sm text-white rounded disabled:opacity-50"
          >
            {chatSending ? "…" : "Send"}
          </button>
        </form>
      </div>

      {showWorkspace ? (
        <section className="flex-[3_1_0%] min-h-[12rem] overflow-visible rounded-lg border border-neutral-800 bg-neutral-950/20 p-3 md:overflow-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {workspaceItem?.label ?? "Canvas"}
              </span>
              {pageReference ? (
                <span className="rounded border border-amber-700/60 bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  Reference mock
                </span>
              ) : (
                <span className="rounded border border-emerald-800/60 bg-emerald-950/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  Native view
                </span>
              )}
              {pageReference && referencePage.loading ? (
                <span className="font-mono text-[10px] text-sky-400">Generating…</span>
              ) : null}
            </div>
            {pageReference ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-neutral-500">
                  {referencePage.modelRoute
                    ? `${referencePage.modelRoute.provider || "router"} / ${referencePage.modelRoute.model || "selected model"}`
                    : "selected provider / model"}
                </span>
                <button
                  type="button"
                  onClick={() => void referencePage.regenerate()}
                  disabled={referencePage.loading}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] font-medium text-neutral-300 hover:border-sky-700 hover:text-white focus:outline-none focus:ring-1 focus:ring-sky-600 disabled:opacity-40"
                >
                  Regenerate
                </button>
              </div>
            ) : null}
          </div>
          {pageReference ? (
            <div role="status" className="mb-3 border-l-2 border-amber-500 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              <strong className="mr-1 font-semibold uppercase tracking-wider">Reference mock.</strong>
              Generated from <span className="font-mono">{pageReference.sourcePath}</span>. Values and actions are not live unless the rendered view explicitly identifies a live binding.
            </div>
          ) : null}
          {pageReference && referencePage.error ? (
            <div role="alert" className="mb-3 flex items-start justify-between gap-3 rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              <div>
                <div className="font-semibold">{workspaceItem?.label} generation failed</div>
                <div className="mt-0.5 font-mono text-[10px] text-red-400">{referencePage.error}</div>
              </div>
              <button
                type="button"
                onClick={() => void referencePage.retry()}
                className="shrink-0 rounded border border-red-700 px-2 py-1 text-[10px] hover:bg-red-900/50 focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                Retry
              </button>
            </div>
          ) : null}
          {workspaceSpec ? (
            <WorkspaceBoundary revision={(workspaceRoute?.length ?? 0) + referencePage.revision}>
              {workspaceRoute === null ? (
                <GeneratedSpecRenderer spec={workspaceSpec} registry={registry} />
              ) : (
                <Renderer key={`${workspaceRoute}:${referencePage.revision}`} spec={workspaceSpec} registry={registry} />
              )}
            </WorkspaceBoundary>
          ) : pageReference && referencePage.loading ? (
            <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-800 bg-neutral-950/30">
              <div className="text-center">
                <div className="text-sm font-medium text-neutral-300">Generating {pageReference.label}</div>
                <div className="mt-1 font-mono text-[10px] text-neutral-500">
                  {referencePage.modelRoute
                    ? `${referencePage.modelRoute.provider || "router"} / ${referencePage.modelRoute.model || "selected model"}`
                    : "Resolving selected provider and model…"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              Choose a page from the categorized navigation above. It will open here without replacing the chatbot.
              You can also ask the chatbot to render a new interface in this Canvas.
            </p>
          )}
        </section>
      ) : null}
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
