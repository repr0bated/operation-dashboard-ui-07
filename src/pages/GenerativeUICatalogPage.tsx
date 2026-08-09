/**
 * Generative UI Catalog — 200-element rolling gallery
 * LLM-generated specs streamed via gRPC, rendered through DSL interpreter
 * LLM is blind to rendering (only sees schema + constraints)
 */

import { useState, useEffect } from "react";
import { Card, PageHeader } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RefreshCw,
  Zap,
  Eye,
  Code2,
  Sparkles,
} from "lucide-react";
import {
  DslNode,
  renderDslNode,
  validateDslSpec,
  checkForbiddenPatterns,
} from "@/components/DslInterpreter";

interface MintContext {
  scenario: string;
  dataShape: string;
  signalToConvey: string;
  actionToAfford: string;
  constraints: string[];
  tradeOffVector: string;
  forbiddenPatterns: string[];
}

interface CatalogElement {
  id: string;
  spec: DslNode;
  mintContext: MintContext;
  mintedAt: string;
  diagnostics: string[];
  viewCount: number;
}

const EXAMPLE_ELEMENTS: CatalogElement[] = [
  {
    id: "elem-001",
    spec: {
      kind: "panel",
      title: "Request Latency",
      children: [
        {
          kind: "stack",
          axis: "row",
          gap: 8,
          children: [
            { kind: "spark", label: "p95", trend: 12 },
            { kind: "spark", label: "p99", trend: -5 },
            { kind: "value", value: "247ms", format: "duration_ms" },
          ],
        },
      ],
    },
    mintContext: {
      scenario: "Operator monitors API tail latency during traffic surge",
      dataShape: "time series with p50/p95/p99 quantiles",
      signalToConvey: "Latency headroom before SLA breach",
      actionToAfford: "Quick drill into slowest services",
      constraints: [
        "No more than 4 metrics visible",
        "Forbidden: gauge charts, radial designs",
        "Must fit <300px width",
      ],
      tradeOffVector: "Clarity over density",
      forbiddenPatterns: ["gauge", "radial", "donut"],
    },
    mintedAt: new Date(Date.now() - 3600000).toISOString(),
    diagnostics: [],
    viewCount: 47,
  },
  {
    id: "elem-002",
    spec: {
      kind: "stack",
      axis: "col",
      gap: 8,
      children: [
        {
          kind: "text",
          value: "Pod Eviction Events",
          tone: "accent",
        },
        {
          kind: "grid",
          cols: 2,
          gap: 4,
          children: [
            {
              kind: "stack",
              axis: "row",
              gap: 4,
              children: [
                { kind: "chip", label: "OOMKilled", intent: "danger" },
                { kind: "value", value: "12", format: "number" },
              ],
            },
            {
              kind: "stack",
              axis: "row",
              gap: 4,
              children: [
                { kind: "chip", label: "Evicted", intent: "warn" },
                { kind: "value", value: "3", format: "number" },
              ],
            },
          ],
        },
      ],
    },
    mintContext: {
      scenario: "Operator triages pod lifecycle events in a cluster",
      dataShape: "Event counts keyed by reason",
      signalToConvey: "Health risk and urgency",
      actionToAfford: "Filter events by reason, view logs",
      constraints: [
        "Compact 2-column layout",
        "Forbidden: tree views, nested lists",
        "Color only for intent (danger/warn)",
      ],
      tradeOffVector: "Density over interactivity",
      forbiddenPatterns: ["tree", "nested_list", "hierarchy"],
    },
    mintedAt: new Date(Date.now() - 7200000).toISOString(),
    diagnostics: [],
    viewCount: 23,
  },
  {
    id: "elem-003",
    spec: {
      kind: "stack",
      axis: "col",
      gap: 4,
      children: [
        {
          kind: "text",
          value: "Service Health",
          tone: "default",
        },
        {
          kind: "list",
          items: [
            "Frontend: healthy (p95: 45ms)",
            "API: degraded (errors: 0.2%)",
            "Auth: healthy (uptime: 99.99%)",
            "Cache: recovering (15/32 nodes)",
          ],
        },
        {
          kind: "action",
          label: "View Details",
          disabled: false,
        },
      ],
    },
    mintContext: {
      scenario: "Operator scans service status at a glance",
      dataShape: "Service name + status + one key metric",
      signalToConvey: "Which service needs attention now",
      actionToAfford: "Drill into health details",
      constraints: [
        "Flat list, no nesting",
        "Forbidden: sparklines in this context",
        "Max 5 services visible",
      ],
      tradeOffVector: "Scannability over detail",
      forbiddenPatterns: ["sparkline_in_list"],
    },
    mintedAt: new Date(Date.now() - 10800000).toISOString(),
    diagnostics: [],
    viewCount: 89,
  },
];

export default function GenerativeUICatalogPage() {
  const [elements, setElements] = useState<CatalogElement[]>(EXAMPLE_ELEMENTS);
  const [selectedId, setSelectedId] = useState(EXAMPLE_ELEMENTS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedElement = elements.find((e) => e.id === selectedId);

  const validateElement = (el: CatalogElement) => {
    const diagnostics: string[] = [];

    // Check forbidden patterns
    diagnostics.push(...checkForbiddenPatterns(el.spec));

    // Validate DSL structure
    diagnostics.push(...validateDslSpec(el.spec));

    return diagnostics;
  };

  const regenerateElement = async () => {
    if (!selectedElement) return;
    setLoading(true);
    try {
      // Simulate mint request (in real impl, calls gemma_brain)
      // LLM sees only: scenario, dataShape, signalToConvey, actionToAfford, constraints
      // LLM does NOT see the rendered output (blind)
      // LLM generates new spec that conforms to DSL schema
      await new Promise((r) => setTimeout(r, 800));

      // For demo, just update view count
      setElements(
        elements.map((e) =>
          e.id === selectedId
            ? {
                ...e,
                viewCount: e.viewCount + 1,
                mintedAt: new Date().toISOString(),
              }
            : e
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regen failed");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedElement) {
    return <div>No element selected</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generative UI Catalog"
        subtitle="200-element rolling gallery of LLM-generated specs. LLM blind to rendering."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={regenerateElement}
              disabled={loading}
              variant="outline"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
            <Button size="sm" onClick={regenerateElement} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Mint New
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Gallery Sidebar */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground">
            ELEMENTS ({elements.length})
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {elements.map((el) => (
              <button
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                  selectedId === el.id
                    ? "bg-primary/10 border-primary"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="font-mono text-[10px] mb-1">{el.id}</div>
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{el.viewCount}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Display */}
        <div className="lg:col-span-3 space-y-6">
          {/* Rendered Element */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Rendered
                </div>
                <Badge variant="secondary" className="text-xs">
                  {selectedElement.diagnostics.length === 0 ? "✓ Valid" : "⚠ Issues"}
                </Badge>
              </div>

              <div className="border border-border rounded-md p-4 bg-muted/30">
                {renderDslNode(selectedElement.spec)}
              </div>

              {selectedElement.diagnostics.length > 0 && (
                <div className="space-y-1">
                  {selectedElement.diagnostics.map((d, i) => (
                    <div key={i} className="text-xs text-red-600 flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Mint Context */}
          <Card className="bg-blue-50/5 border-blue-500/20">
            <div className="space-y-3 text-xs">
              <div className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Mint Context (LLM sees this, not the render)
              </div>

              <div className="space-y-2 text-muted-foreground">
                <div>
                  <div className="font-semibold text-foreground">Scenario</div>
                  <div className="font-mono text-[10px]">
                    {selectedElement.mintContext.scenario}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-foreground">Data Shape</div>
                  <div className="font-mono text-[10px]">
                    {selectedElement.mintContext.dataShape}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="font-semibold text-foreground">Signal</div>
                    <div className="font-mono text-[10px]">
                      {selectedElement.mintContext.signalToConvey}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Action</div>
                    <div className="font-mono text-[10px]">
                      {selectedElement.mintContext.actionToAfford}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-foreground mb-1">Constraints</div>
                  <div className="space-y-1">
                    {selectedElement.mintContext.constraints.map((c, i) => (
                      <div key={i} className="font-mono text-[10px] text-foreground">
                        • {c}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-foreground">Trade-Off</div>
                  <div className="font-mono text-[10px]">
                    {selectedElement.mintContext.tradeOffVector}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-foreground mb-1">Forbidden</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedElement.mintContext.forbiddenPatterns.map((p) => (
                      <Badge key={p} variant="destructive" className="text-[10px]">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* DSL Spec */}
          <Card>
            <div className="space-y-2">
              <div className="text-xs font-semibold flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                DSL Spec (JSON)
              </div>
              <pre className="font-mono text-[10px] overflow-x-auto bg-muted/30 p-2 rounded max-h-64">
                {JSON.stringify(selectedElement.spec, null, 2)}
              </pre>
            </div>
          </Card>

          {/* Metadata */}
          <Card className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>ID:</span>
              <span className="font-mono">{selectedElement.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Minted:</span>
              <span className="font-mono">
                {new Date(selectedElement.mintedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Views:</span>
              <span>{selectedElement.viewCount}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* How It Works */}
      <Card className="bg-green-50/5 border-green-500/20">
        <div className="space-y-3 text-sm">
          <div className="font-semibold">How LLM Minting Works (Blind Exploration)</div>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <strong>1. Mint Request:</strong> System sends scenario + data shape + signal + action + constraints to gemma
            </li>
            <li>
              <strong>2. LLM Blind:</strong> gemma does NOT see the rendered UI. It only sees the DSL schema and constraints.
            </li>
            <li>
              <strong>3. Generate Spec:</strong> gemma generates a JSON spec conforming to the DSL, avoiding forbidden patterns
            </li>
            <li>
              <strong>4. Validate:</strong> Frontend validates spec (schema, node count, forbidden patterns)
            </li>
            <li>
              <strong>5. Render:</strong> DSL interpreter renders the spec safely (no eval, no DOM escape)
            </li>
            <li>
              <strong>6. Rotate:</strong> After time/views, element is evicted and new one mints
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
