/**
 * Zero Specs — Explore Kiro-generated specs as semantic graphs
 * Query, patch, validate DSL nodes using zerolang agent loop
 */

import { useState, useEffect } from "react";
import { Card, PageHeader } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, CheckCircle2, Zap } from "lucide-react";

interface SpecNode {
  id: string;
  kind: string;
  version: u64;
  constraints: string[];
  children?: SpecNode[];
}

interface KiroSpec {
  id: string;
  version: u64;
  node_count: number;
  is_valid: boolean;
  created_at: string;
}

export default function ZeroSpecsPage() {
  const [specs, setSpecs] = useState<KiroSpec[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<KiroSpec | null>(null);
  const [nodes, setNodes] = useState<SpecNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query Kiro specs via plugin system
  const loadSpecs = async () => {
    setLoading(true);
    setError(null);
    try {
      // In real implementation, this would call the plugin system
      // to fetch Kiro-generated specs from /dev/shm blobs
      const mockSpecs: KiroSpec[] = [
        {
          id: "gallery-ui-001",
          version: 3,
          node_count: 42,
          is_valid: true,
          created_at: "2026-08-09T10:30:00Z",
        },
        {
          id: "catalog-pattern-001",
          version: 1,
          node_count: 28,
          is_valid: true,
          created_at: "2026-08-08T15:45:00Z",
        },
        {
          id: "operator-console-001",
          version: 5,
          node_count: 156,
          is_valid: true,
          created_at: "2026-08-07T09:15:00Z",
        },
      ];
      setSpecs(mockSpecs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load specs");
    } finally {
      setLoading(false);
    }
  };

  // Query spec nodes via agent loop
  const loadSpecNodes = async (spec: KiroSpec) => {
    setLoading(true);
    setError(null);
    try {
      setSelectedSpec(spec);

      // In real implementation, this would use the agent loop to:
      // 1. Query spec_by_id(spec.id)
      // 2. Traverse the blob nodes via JSONPath
      // 3. Build semantic graph structure
      const mockNodes: SpecNode[] = [
        {
          id: `${spec.id}/root`,
          kind: "stack",
          version: spec.version,
          constraints: ["maxNodeCount:200", "noForbiddenNames"],
          children: [
            {
              id: `${spec.id}/header`,
              kind: "section",
              version: spec.version,
              constraints: ["requiredMetadata:[title,description]"],
              children: [
                {
                  id: `${spec.id}/header/title`,
                  kind: "text",
                  version: spec.version,
                  constraints: [],
                },
              ],
            },
            {
              id: `${spec.id}/content`,
              kind: "container",
              version: spec.version,
              constraints: [],
              children: [
                {
                  id: `${spec.id}/content/card-1`,
                  kind: "card",
                  version: spec.version,
                  constraints: [],
                },
                {
                  id: `${spec.id}/content/card-2`,
                  kind: "card",
                  version: spec.version,
                  constraints: [],
                },
              ],
            },
          ],
        },
      ];
      setNodes(mockNodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load nodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpecs();
  }, []);

  const renderNodeTree = (node: SpecNode, depth = 0) => (
    <div key={node.id} style={{ marginLeft: `${depth * 20}px` }} className="space-y-1">
      <div className="flex items-center gap-2 py-1">
        <div className="flex items-center gap-1 flex-1">
          <Badge variant="secondary" className="text-xs">
            {node.kind}
          </Badge>
          <span className="text-xs font-mono text-muted-foreground">{node.id}</span>
          <span className="text-xs text-muted-foreground">v{node.version}</span>
        </div>
      </div>
      {node.constraints.length > 0 && (
        <div className="flex gap-1 flex-wrap ml-0">
          {node.constraints.map((c) => (
            <Badge key={c} variant="outline" className="text-[10px]">
              {c}
            </Badge>
          ))}
        </div>
      )}
      {node.children?.map((child) => renderNodeTree(child, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zero Specs"
        subtitle="Explore Kiro-generated specs as semantic graphs. Query, validate, patch DSL nodes."
        actions={
          <Button size="sm" onClick={loadSpecs} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50/30 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specs Catalog */}
        <Card className="lg:col-span-1">
          <div className="space-y-4">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Kiro Specs Catalog
            </div>
            <div className="space-y-2">
              {loading && specs.length === 0 ? (
                <div className="text-xs text-muted-foreground">Loading specs...</div>
              ) : specs.length === 0 ? (
                <div className="text-xs text-muted-foreground">No specs found</div>
              ) : (
                specs.map((spec) => (
                  <button
                    key={spec.id}
                    onClick={() => loadSpecNodes(spec)}
                    className={`w-full text-left p-2 rounded-md border text-xs transition-colors ${
                      selectedSpec?.id === spec.id
                        ? "bg-primary/10 border-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono">{spec.id}</span>
                      {spec.is_valid && (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      v{spec.version} · {spec.node_count} nodes
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Spec Node Tree */}
        <Card className="lg:col-span-2">
          <div className="space-y-4">
            <div className="text-sm font-semibold">
              {selectedSpec ? `${selectedSpec.id} (semantic graph)` : "Select a spec to view"}
            </div>

            {selectedSpec && (
              <div className="space-y-1 text-xs">
                <div className="flex gap-4 text-muted-foreground">
                  <div>v{selectedSpec.version}</div>
                  <div>{selectedSpec.node_count} nodes</div>
                  <div>{new Date(selectedSpec.created_at).toLocaleString()}</div>
                </div>
              </div>
            )}

            {nodes.length > 0 ? (
              <div className="border border-border rounded-md p-3 bg-muted/30 font-mono text-xs overflow-x-auto">
                {nodes.map((node) => renderNodeTree(node))}
              </div>
            ) : selectedSpec ? (
              <div className="text-xs text-muted-foreground">No nodes loaded</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Select a spec to view its semantic graph structure
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Agent Loop Info */}
      <Card className="bg-blue-50/5 border-blue-500/20">
        <div className="space-y-3 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" />
            How it works (zerolang agent loop)
          </div>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <strong>Query phase:</strong> Agent calls <code className="bg-muted px-1 rounded">query_kiro_specs()</code> to
              fetch specs from plugin system (blobs in /dev/shm)
            </li>
            <li>
              <strong>Explore phase:</strong> Agent calls{" "}
              <code className="bg-muted px-1 rounded">agent_query(spec_id, path)</code> to traverse
              semantic graph nodes
            </li>
            <li>
              <strong>Validate phase:</strong> Agent calls{" "}
              <code className="bg-muted px-1 rounded">validate_kiro_spec()</code> against Kiro schema
            </li>
            <li>
              <strong>Patch phase:</strong> Agent calls{" "}
              <code className="bg-muted px-1 rounded">agent_patch()</code> with JSON Patch RFC 6902
              operations
            </li>
            <li>
              <strong>Audit:</strong> All agent actions recorded in immutable audit trail
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
