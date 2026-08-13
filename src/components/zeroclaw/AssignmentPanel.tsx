/**
 * Card listing one or more zeroclaw assignment roles with live pickers.
 */
import { AssignmentModelSelect } from "@/components/zeroclaw/AssignmentModelSelect";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import { ASSIGNMENT_META, type AssignmentRole } from "@/lib/zeroclaw-routing";
import { cn } from "@/lib/utils";
import { Orbit } from "lucide-react";

interface Props {
  title: string;
  hint: string;
  roles: AssignmentRole[];
  className?: string;
}

export function AssignmentPanel({ title, hint, roles, className }: Props) {
  const { state } = useZeroclawRouting();

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 space-y-3", className)}>
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Orbit className="h-4 w-4 text-primary" /> {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </div>
      <div className="space-y-3">
        {roles.map((role) => {
          const current = state.assignments[role];
          return (
            <div key={role} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">{ASSIGNMENT_META[role].label}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {current ?? "unassigned"}
                </div>
              </div>
              <AssignmentModelSelect role={role} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
