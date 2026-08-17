import { useState } from "react";
import { Card, Callout } from "@/components/shell/Primitives";
import {
  IMMUTABLE_PROMPT,
  DEFAULT_TUNABLE_PROMPT,
  getTunableSystemPrompt,
  setTunableSystemPrompt,
  getEffectiveSystemPrompt,
} from "@/lib/system-prompt";
import { Lock, Pencil, RotateCcw, Copy, Check } from "lucide-react";

export function SystemPromptEditor() {
  const [tunable, setTunable] = useState(() => getTunableSystemPrompt());
  const [savedTunable, setSavedTunable] = useState(() => getTunableSystemPrompt());
  const [copied, setCopied] = useState<"immutable" | "tunable" | null>(null);
  const isDirty = tunable !== savedTunable;
  const effective = getEffectiveSystemPrompt(isDirty ? tunable : savedTunable);

  const handleSave = () => {
    setTunableSystemPrompt(tunable);
    setSavedTunable(tunable);
  };

  const handleReset = () => {
    setTunable(DEFAULT_TUNABLE_PROMPT);
  };

  const handleCopy = (text: string, section: "immutable" | "tunable") => {
    void navigator.clipboard.writeText(text);
    setCopied(section);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          System Prompt
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Core rules are immutable. Operator preferences apply on the next Main Chat
          message. Configure here on Assistant — Chat only consumes the saved prompt.
        </p>
      </div>

      {/* Immutable Section */}
      <Card
        title="Core Rules"
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 border border-border rounded px-2 py-0.5">
              <Lock className="h-3 w-3" /> Read-only
            </span>
            <button
              onClick={() => handleCopy(IMMUTABLE_PROMPT, "immutable")}
              className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy to clipboard"
            >
              {copied === "immutable" ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        }
      >
        <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap bg-background/50 rounded-md border border-border p-3 max-h-[300px] overflow-auto select-text">
          {IMMUTABLE_PROMPT}
        </pre>
        <Callout variant="warn" className="mt-3 text-xs">
          These rules are enforced by the backend and cannot be modified from the UI.
          They ensure the LLM always uses native tool calls instead of suggesting CLI commands.
        </Callout>
      </Card>

      {/* Tunable Section */}
      <Card
        title="Operator Preferences"
        subtitle="Saved for Main Chat. Changes apply to the next message sent."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
              <Pencil className="h-3 w-3" /> Editable
            </span>
            <button
              onClick={() => handleCopy(tunable, "tunable")}
              className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy to clipboard"
            >
              {copied === "tunable" ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        }
      >
        <textarea
          value={tunable}
          onChange={(e) => setTunable(e.target.value)}
          className="w-full font-mono text-[11px] leading-relaxed text-foreground bg-background/50 rounded-md border border-border p-3 min-h-[260px] max-h-[400px] resize-y outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
          spellCheck={false}
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-[10px] text-warn font-medium">Unsaved changes</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset defaults
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Apply to chat
            </button>
          </div>
        </div>
      </Card>

      {/* Combined preview */}
      <Card title="Effective Prompt Preview" subtitle="What Main Chat attaches as the system message on send.">
        <pre className="font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap bg-background/50 rounded-md border border-border p-3 max-h-[200px] overflow-auto select-text">
          {effective}
        </pre>
        <div className="mt-2 text-[10px] text-muted-foreground">
          {effective.length.toLocaleString()} characters · {effective.split("\n").length} lines
        </div>
      </Card>
    </div>
  );
}
