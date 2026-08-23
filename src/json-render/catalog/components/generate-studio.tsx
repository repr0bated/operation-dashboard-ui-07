import { Component, type ErrorInfo, type ReactNode } from "react";
import { tryGetAppRegistry } from "../registry-holder";
import { useTileObject } from "@/json-render/generate/use-tile-object";
import { GeneratedSpecRenderer } from "@/json-render/runtime/GeneratedSpecRenderer";
import type { El } from "./types";

class PreviewBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[generate]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return <p className="text-xs text-destructive font-mono">{this.state.error}</p>;
    }
    return this.props.children;
  }
}

export const GenerateStudioEl: El<"generateStudio"> = ({ props }) => {
  const { prompt, setPrompt, raw, spec, error, sending, generate } = useTileObject();
  const registry = tryGetAppRegistry();
  const tileCount = (raw.match(/"kind"\s*:/g) ?? []).length;

  return (
    <div className={`flex flex-col gap-4 min-h-[32rem] ${props.className ?? ""}`}>
      <form onSubmit={generate} className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={sending}
          rows={3}
          className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono"
            placeholder="Ask for data. The model streams JSON tiles; this page styles them."
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={sending || !prompt.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Streaming tile data…" : "Stream tiles"}
          </button>
          <span className="text-[11px] text-muted-foreground font-mono">
            ChatService · streamObject JSON · client autotile
          </span>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <section
          data-testid="generated-result-panel"
          aria-labelledby="generated-result-label"
          className="w-full rounded-md border border-border bg-card/40 p-3"
        >
          <div
            id="generated-result-label"
            className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            <span>Generated result</span>
            {sending ? (
              <span role="status" className="normal-case tracking-normal text-sky-400">
                {tileCount > 0
                  ? `${tileCount} tile${tileCount === 1 ? "" : "s"} received`
                  : "Waiting for first tile object…"}
              </span>
            ) : null}
          </div>
          {spec && registry ? (
            <PreviewBoundary>
              <GeneratedSpecRenderer spec={spec} registry={registry} loading={sending} />
            </PreviewBoundary>
          ) : (
            <p className="py-6 text-xs text-muted-foreground italic">
              Tiles appear as soon as the first complete objects arrive.
            </p>
          )}
        </section>
        <section
          data-testid="specstream-diagnostics-panel"
          aria-labelledby="specstream-diagnostics-label"
          className="max-h-[18rem] min-h-[10rem] w-full overflow-auto rounded-md border border-border bg-card/40 p-3"
        >
          <div
            id="specstream-diagnostics-label"
            className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            Supporting tile JSON
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground">
            {raw || "waiting for tile object…"}
          </pre>
        </section>
      </div>
    </div>
  );
};
