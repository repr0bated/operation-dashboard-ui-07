import { Component, type ErrorInfo, type ReactNode } from "react";
import { tryGetAppRegistry } from "../registry-holder";
import { useGenerateSpec } from "@/json-render/generate/use-generate-spec";
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
  const { prompt, setPrompt, raw, spec, error, sending, generate } = useGenerateSpec();
  const registry = tryGetAppRegistry();
  const patchCount = raw.split("\n").filter((line) => line.trim().startsWith("{")).length;

  return (
    <div className={`flex flex-col gap-4 min-h-[32rem] ${props.className ?? ""}`}>
      <form onSubmit={generate} className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={sending}
          rows={3}
          className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono"
          placeholder="Describe the UI to build progressively on this page…"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={sending || !prompt.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Rendering patches…" : "Generate UI"}
          </button>
          <span className="text-[11px] text-muted-foreground font-mono">
            ChatService · json-render SpecStream · live RFC 6902 patches
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
                {patchCount > 0 ? `${patchCount} patch${patchCount === 1 ? "" : "es"} received` : "Waiting for first patch…"}
              </span>
            ) : null}
          </div>
          {spec && registry ? (
            <PreviewBoundary>
              <GeneratedSpecRenderer spec={spec} registry={registry} loading={sending} />
            </PreviewBoundary>
          ) : (
            <p className="py-6 text-xs text-muted-foreground italic">
              The current page starts rendering as soon as the root patches arrive.
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
            Supporting SpecStream output
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground">
            {raw || "waiting for JSONL patches…"}
          </pre>
        </section>
      </div>
    </div>
  );
};
