/**
 * Zero Agent — Agent repair loop
 * Query graph, submit patches, type-check, render results
 */

import { useState } from "react";
import { Card, PageHeader } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Zap,
  TrendingUp,
  GitBranch,
} from "lucide-react";

interface PatchOperation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
}

interface AgentPatch {
  id: string;
  spec_id: string;
  reason: string;
  patches: PatchOperation[];
  status: "pending" | "accepted" | "rejected";
  error?: string;
  created_at: string;
}

interface RepairResult {
  spec_id: string;
  previous_version: number;
  new_version: number;
  violations_found: number;
  violations_repaired: number;
  audit_trace: string;
}

export default function ZeroAgentPage() {
  const [agentId, setAgentId] = useState("agent-repair-001");
  const [selectedSpec, setSelectedSpec] = useState("gallery-ui-001");
  const [patches, setPatches] = useState<AgentPatch[]>([]);
  const [results, setResults] = useState<RepairResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate agent running constraint_repair_agent
  const runRepairAgent = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate agent finding constraint violations and repairing them
      const mockPatches: AgentPatch[] = [
        {
          id: "patch-001",
          spec_id: selectedSpec,
          reason: "Exceeded max node count (200). Removing least-critical footer nodes.",
          patches: [
            {
              op: "remove",
              path: "/nodes/3/children/5",
            },
            {
              op: "remove",
              path: "/nodes/3/children/4",
            },
          ],
          status: "accepted",
          created_at: new Date().toISOString(),
        },
        {
          id: "patch-002",
          spec_id: selectedSpec,
          reason: "Renaming forbidden field '__internal' to '_internal'",
          patches: [
            {
              op: "replace",
              path: "/nodes/1/metadata/field_name",
              value: "_internal_cache",
            },
          ],
          status: "accepted",
          created_at: new Date().toISOString(),
        },
      ];

      setPatches(mockPatches);

      // Simulate Kiro regeneration and result
      const mockResult: RepairResult = {
        spec_id: selectedSpec,
        previous_version: 3,
        new_version: 4,
        violations_found: 2,
        violations_repaired: 2,
        audit_trace: `[${new Date().toISOString()}] ${agentId}: Constraint repair loop completed. 2 violations fixed.`,
      };

      setResults(mockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setLoading(false);
    }
  };

  // Simulate agent running ui_spec_generator_agent
  const runGeneratorAgent = async () => {
    setLoading(true);
    setError(null);
    try {
      const mockPatches: AgentPatch[] = [
        {
          id: "patch-gen-001",
          spec_id: selectedSpec,
          reason: "Generated new UI spec: stack with signal='chart' action='export'",
          patches: [
            {
              op: "add",
              path: "/nodes/-",
              value: {
                kind: "stack",
                axis: "col",
                signal: "chart",
                action: "export",
              },
            },
          ],
          status: "accepted",
          created_at: new Date().toISOString(),
        },
      ];

      setPatches(mockPatches);

      const mockResult: RepairResult = {
        spec_id: selectedSpec,
        previous_version: 3,
        new_version: 4,
        violations_found: 0,
        violations_repaired: 1, // 1 new node added
        audit_trace: `[${new Date().toISOString()}] ${agentId}: Generated UI spec node successfully.`,
      };

      setResults(mockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zero Agent"
        subtitle="Agent repair loop — query graph, submit patches, type-check, render"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={runRepairAgent}
              disabled={loading}
              variant="outline"
            >
              <Zap className="h-4 w-4 mr-2" />
              Run Repair
            </Button>
            <Button size="sm" onClick={runGeneratorAgent} disabled={loading}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Run Generator
            </Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50/30 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Configuration */}
        <Card>
          <div className="space-y-4">
            <div className="text-sm font-semibold">Agent Configuration</div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground">Agent ID</label>
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full mt-1 px-2 py-1 rounded-md border border-border bg-background"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-muted-foreground">Target Spec</label>
                <select
                  value={selectedSpec}
                  onChange={(e) => setSelectedSpec(e.target.value)}
                  className="w-full mt-1 px-2 py-1 rounded-md border border-border bg-background"
                  disabled={loading}
                >
                  <option>gallery-ui-001</option>
                  <option>catalog-pattern-001</option>
                  <option>operator-console-001</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Results */}
        {results && (
          <Card>
            <div className="space-y-4">
              <div className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Repair Complete
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previous version:</span>
                  <span className="font-mono">v{results.previous_version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New version:</span>
                  <span className="font-mono">v{results.new_version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Violations found:</span>
                  <span>{results.violations_found}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Violations repaired:</span>
                  <span className="text-green-600">{results.violations_repaired}</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Patch Log */}
      <Card>
        <div className="space-y-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Patches Submitted ({patches.length})
          </div>

          {patches.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No patches yet. Run an agent loop to see patches here.
            </div>
          ) : (
            <div className="space-y-3">
              {patches.map((patch) => (
                <div
                  key={patch.id}
                  className="border border-border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs">{patch.id}</span>
                        <Badge
                          variant={
                            patch.status === "accepted"
                              ? "default"
                              : patch.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {patch.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {patch.reason}
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-2 space-y-1">
                    {patch.patches.map((op, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-[10px] font-mono"
                      >
                        <Badge variant="outline" className="text-[9px]">
                          {op.op}
                        </Badge>
                        <span className="text-muted-foreground">{op.path}</span>
                        {op.value && (
                          <span className="text-green-600">
                            {JSON.stringify(op.value).substring(0, 50)}...
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {patch.error && (
                    <div className="text-[10px] text-red-600">{patch.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Audit Trail */}
      {results && (
        <Card className="bg-muted/30">
          <div className="space-y-2">
            <div className="text-xs font-mono font-semibold">Audit Trail</div>
            <div className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
              {results.audit_trace}
            </div>
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-blue-50/5 border-blue-500/20">
        <div className="space-y-3 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Agent Loop Execution Model
          </div>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <strong>1. Query:</strong> Agent calls <code className="bg-muted px-1 rounded">query_spec_by_id()</code> to load Kiro-generated
              spec from blob
            </li>
            <li>
              <strong>2. Validate:</strong> Agent calls{" "}
              <code className="bg-muted px-1 rounded">validate_kiro_spec()</code> to check
              against schema
            </li>
            <li>
              <strong>3. Analyze:</strong> Agent calls{" "}
              <code className="bg-muted px-1 rounded">check_constraint()</code> for each
              constraint
            </li>
            <li>
              <strong>4. Build Patches:</strong> Agent builds JSON Patch RFC 6902
              operations to fix violations
            </li>
            <li>
              <strong>5. Submit:</strong> Agent calls{" "}
              <code className="bg-muted px-1 rounded">agent_patch()</code> via plugin
              system
            </li>
            <li>
              <strong>6. Kiro Regenerates:</strong> Plugin system passes patches to
              Kiro, which regenerates spec blob
            </li>
            <li>
              <strong>7. Audit Trail:</strong> Immutable record of agent actions and
              results
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
