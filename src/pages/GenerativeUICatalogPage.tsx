/**
 * Generative UI Catalog — 200-element rolling gallery
 * LLM-generated specs (no hardcoded mocks), streamed via CatalogService
 * Model-agnostic: Claude, GPT, Gemini, Llama
 */

import { useState, useEffect } from "react";
import { Card, PageHeader } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Eye,
  Code2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  renderDslNode,
  validateDslSpec,
  checkForbiddenPatterns,
} from "@/components/DslInterpreter";
import {
  CatalogElement,
  MintRequest,
  getCatalogStore,
  mintSpec,
} from "@/lib/catalog-service";

export default function GenerativeUICatalogPage() {
  const [elements, setElements] = useState<CatalogElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintModel, setMintModel] = useState<"claude" | "gpt" | "gemini" | "llama">(
    "claude"
  );

  const store = getCatalogStore();
  const selectedElement = elements.find((e) => e.id === selectedId);

  // Subscribe to catalog stream on mount
  useEffect(() => {
    const unsubscribe = store.subscribe((frame) => {
      if (frame.type === "snapshot") {
        setElements(frame.elements);
        if (frame.elements.length > 0 && !selectedId) {
          setSelectedId(frame.elements[0].id);
        }
      } else if (frame.type === "upsert") {
        setElements((prev) => {
          const filtered = prev.filter((e) => e.id !== frame.element.id);
          return [frame.element, ...filtered];
        });
        if (!selectedId || selectedId === frame.element.id) {
          setSelectedId(frame.element.id);
        }
      } else if (frame.type === "evict") {
        setElements((prev) => prev.filter((e) => e.id !== frame.element_id));
        if (selectedId === frame.element_id) {
          const remaining = elements.filter((e) => e.id !== frame.element_id);
          setSelectedId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    });

    return unsubscribe;
  }, []);

  const mintNewElement = async () => {
    setLoading(true);
    setError(null);
    try {
      const request: MintRequest = {
        scenario: "Operator monitors system health during incident",
        data_shape: "service name + status + one key metric",
        signal_to_convey: "Which service needs attention",
        action_to_afford: "Drill into service details",
        constraints: [
          "Compact layout, ≤4 metrics",
          "Forbidden: tree views, nested lists",
          "Color only for intent",
        ],
        trade_off_vector: "Clarity over density",
        forbidden_patterns: ["tree", "nested_list", "gauge", "radial"],
        model: mintModel,
      };

      const response = await mintSpec(request, mintModel);

      if (!response.valid) {
        setError(
          `Invalid spec from ${mintModel}: ${response.diagnostics.join(", ")}`
        );
        return;
      }

      const dslErrors = validateDslSpec(response.spec);
      const forbiddenErrors = checkForbiddenPatterns(response.spec);
      const allDiagnostics = [...dslErrors, ...forbiddenErrors, ...response.diagnostics];

      const element: CatalogElement = {
        id: `elem-${Date.now()}`,
        spec: response.spec,
        mint_context: response.mint_context,
        minted_at: new Date().toISOString(),
        view_count: 0,
        interaction_score: 0,
        diagnostics: allDiagnostics,
      };

      store.upsert(element);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  const recordInteraction = (type: "view" | "dwell" | "action") => {
    if (selectedId) {
      store.recordInteraction(selectedId, type);
      setElements((prev) =>
        prev.map((e) =>
          e.id === selectedId ? { ...e, view_count: e.view_count + 1 } : e
        )
      );
    }
  };

  const evictElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) {
      const remaining = elements.filter((e) => e.id !== id);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generative UI Catalog"
        subtitle="200-element rolling gallery. No hardcoded mocks—all specs from LLM."
        actions={
          <div className="flex gap-2">
            <select
              value={mintModel}
              onChange={(e) => setMintModel(e.target.value as any)}
              disabled={loading}
              className="px-2 py-1 rounded-md border border-border bg-background text-xs"
            >
              <option value="claude">Claude</option>
              <option value="gpt">GPT</option>
              <option value="gemini">Gemini</option>
              <option value="llama">Llama</option>
            </select>
            <Button size="sm" onClick={mintNewElement} disabled={loading}>
              <Sparkles className="h-4 w-4 mr-2" />
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

      {elements.length === 0 ? (
        <Card className="text-center p-8">
          <div className="text-muted-foreground space-y-2">
            <div className="text-sm font-semibold">Awaiting First Mint</div>
            <div className="text-xs">
              Click "Mint New" to generate the first LLM-created element
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground">
              ELEMENTS ({elements.length}/200)
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {elements.map((el) => (
                <div
                  key={el.id}
                  className={`rounded-md border text-xs transition-colors ${
                    selectedId === el.id
                      ? "bg-primary/10 border-primary"
                      : "border-border"
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedId(el.id);
                      recordInteraction("view");
                    }}
                    className="w-full text-left px-3 py-2"
                  >
                    <div className="font-mono text-[10px] mb-1">{el.id}</div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{el.view_count}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => evictElement(el.id)}
                    className="w-full text-left px-3 py-1 border-t border-border hover:bg-destructive/10 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="text-[10px]">Evict</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {selectedElement && (
            <div className="lg:col-span-3 space-y-6">
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

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recordInteraction("dwell")}
                      className="text-xs"
                    >
                      Record Dwell
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => recordInteraction("action")}
                      className="text-xs"
                    >
                      Record Action
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="bg-blue-50/5 border-blue-500/20">
                <div className="space-y-3 text-xs">
                  <div className="font-semibold">Mint Context (LLM sees this only)</div>

                  <div className="space-y-2 text-muted-foreground">
                    <div>
                      <div className="font-semibold text-foreground">Scenario</div>
                      <div className="font-mono text-[10px]">
                        {selectedElement.mint_context.scenario}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-foreground">Data Shape</div>
                      <div className="font-mono text-[10px]">
                        {selectedElement.mint_context.data_shape}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="font-semibold text-foreground">Signal</div>
                        <div className="font-mono text-[10px]">
                          {selectedElement.mint_context.signal_to_convey}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Action</div>
                        <div className="font-mono text-[10px]">
                          {selectedElement.mint_context.action_to_afford}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-foreground mb-1">Constraints</div>
                      <div className="space-y-1">
                        {selectedElement.mint_context.constraints.map((c, i) => (
                          <div key={i} className="font-mono text-[10px] text-foreground">
                            • {c}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-foreground">Model</div>
                      <div className="font-mono text-[10px]">
                        {selectedElement.mint_context.model}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

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

              <Card className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="font-mono">{selectedElement.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minted:</span>
                  <span className="font-mono">
                    {new Date(selectedElement.minted_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Views:</span>
                  <span>{selectedElement.view_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Score:</span>
                  <span>{selectedElement.interaction_score.toFixed(2)}</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      <Card className="bg-green-50/5 border-green-500/20">
        <div className="space-y-3 text-sm">
          <div className="font-semibold">How the Catalog Works</div>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <strong>1. No Hardcoded Mocks:</strong> Empty state shows "Awaiting First
              Mint". All elements are LLM-generated.
            </li>
            <li>
              <strong>2. Mint Request:</strong> System sends scenario + data shape + signal
              + action + constraints (DSL schema visible to LLM only)
            </li>
            <li>
              <strong>3. LLM Blind:</strong> LLM does NOT see rendered output. Only schema
              + constraints.
            </li>
            <li>
              <strong>4. Model-Agnostic:</strong> Works with Claude, GPT, Gemini, Llama,
              or any LLM understanding DSL constraints
            </li>
            <li>
              <strong>5. Validate:</strong> Frontend validates spec (schema, node count,
              forbidden patterns)
            </li>
            <li>
              <strong>6. Stream:</strong> Element added to catalog via gRPC frame (Upsert)
            </li>
            <li>
              <strong>7. Rotate:</strong> 200-element FIFO limit. Oldest/lowest-scoring
              evicted (Evict frame)
            </li>
            <li>
              <strong>8. Audit:</strong> View count + interaction score determine eviction
              order
            </li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
