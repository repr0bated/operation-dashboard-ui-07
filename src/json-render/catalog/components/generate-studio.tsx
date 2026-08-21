import { Component, type ErrorInfo, type ReactNode } from "react";
import { Renderer } from "@json-render/react";
import { tryGetAppRegistry } from "../registry-holder";
import { useGenerateSpec } from "@/json-render/generate/use-generate-spec";
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

  return (
    <div className={`flex flex-col gap-4 min-h-[32rem] ${props.className ?? ""}`}>
      <form onSubmit={generate} className="flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={sending}
          rows={3}
          className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono"
          placeholder="Describe the UI to emit as a typed GenerateUi object…"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={sending || !prompt.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Generating…" : "Generate typed spec"}
          </button>
          <span className="text-[11px] text-muted-foreground font-mono">
            ChatService · response_schema = GenerateUiSchema · not JSON Patch
          </span>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 min-h-0 flex-1">
        <div className="rounded-md border border-border bg-card/40 p-3 overflow-auto">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Model JSON
          </div>
          <pre className="text-[11px] font-mono whitespace-pre-wrap text-muted-foreground">
            {raw || "waiting for structured object…"}
          </pre>
        </div>
        <div className="rounded-md border border-border bg-card/40 p-3 overflow-auto min-h-[16rem]">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Validated render
          </div>
          {spec && registry ? (
            <PreviewBoundary>
              <Renderer spec={spec} registry={registry} />
            </PreviewBoundary>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Spec appears here after GenerateUiSchema.parse succeeds.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
