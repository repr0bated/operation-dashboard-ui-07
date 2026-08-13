import { PageHeader, Card, StatCard } from "@/components/shell/Primitives";
import { ErrorBanner } from "@/components/shell/Feedback";
import { AssignmentPanel } from "@/components/zeroclaw/AssignmentPanel";
import { ProviderSelect } from "@/components/shell/ProviderSelect";
import { ModelSelect } from "@/components/shell/ModelSelect";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import { ASSIGNMENT_META, ASSIGNMENT_ROLES } from "@/lib/zeroclaw-routing";
import { Loader2 } from "lucide-react";

export default function LlmPage() {
  const { state, loading, error } = useZeroclawRouting();
  const assigned = ASSIGNMENT_ROLES.filter((role) => state.assignments[role]).length;

  return (
    <>
      <PageHeader
        title="LLM"
        subtitle="Zeroclaw per-role model assignments. Chat SendRequest still uses selected_provider / selected_model."
      />
      {error && <ErrorBanner title="Zeroclaw routing unavailable" message={error} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ASSIGNMENT_ROLES.map((role) => {
          const value = state.assignments[role];
          return (
            <StatCard
              key={role}
              label={ASSIGNMENT_META[role].label}
              value={value ?? "—"}
              variant={value ? "ok" : undefined}
              sub={role}
            />
          );
        })}
        <StatCard
          label="Assigned roles"
          value={loading ? "…" : `${assigned}/${ASSIGNMENT_ROLES.length}`}
          sub="via GetModelAssignments"
        />
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading zeroclaw assignments…
        </div>
      )}
      <AssignmentPanel
        title="Model assignments"
        hint="Each role is set independently. Embedding Pipeline, Knowledge, and Open vSwitch own the same values on their pages."
        roles={[...ASSIGNMENT_ROLES]}
      />
      <Card
        title="Chat routing"
        subtitle="Independent axes: selected_provider and selected_model. A Gemini model does not imply Antigravity."
        actions={
          <div className="flex items-center gap-2">
            <ProviderSelect />
            <ModelSelect />
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Provider</div>
            <div className="font-mono text-foreground mt-0.5">{state.selected_provider ?? "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Model</div>
            <div className="font-mono text-foreground mt-0.5">{state.selected_model ?? "—"}</div>
          </div>
        </div>
      </Card>
    </>
  );
}
