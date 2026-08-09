/**
 * Zero Query — Graph query IDE
 * Explore catalog nodes, symbols, constraints, metadata
 */

import { useState } from "react";
import { Card, PageHeader } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Code2,
  Search,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";

interface QueryResult {
  path: string;
  kind: string;
  value: unknown;
  spec_id: string;
  matched_count: number;
}

export default function ZeroQueryPage() {
  const [query, setQuery] = useState("/structure/patterns[signal='chart']");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryType, setQueryType] = useState<"jsonpath" | "symbol" | "constraint">(
    "jsonpath"
  );

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!query.trim()) {
        setError("Query cannot be empty");
        return;
      }

      // Simulate different query types
      let mockResults: QueryResult[] = [];

      if (queryType === "jsonpath") {
        mockResults = [
          {
            path: "/nodes/1/children/2/signal",
            kind: "attribute",
            value: "chart",
            spec_id: "gallery-ui-001",
            matched_count: 3,
          },
          {
            path: "/nodes/2/metadata/signals[1]",
            kind: "array_element",
            value: "chart",
            spec_id: "catalog-pattern-001",
            matched_count: 1,
          },
          {
            path: "/nodes/3/patterns/chart/signal",
            kind: "nested",
            value: "chart",
            spec_id: "operator-console-001",
            matched_count: 2,
          },
        ];
      } else if (queryType === "symbol") {
        mockResults = [
          {
            path: "Stack#axis",
            kind: "symbol",
            value: "col|row",
            spec_id: "gallery-ui-001",
            matched_count: 5,
          },
          {
            path: "Button#variant",
            kind: "symbol",
            value: "default|outline|destructive",
            spec_id: "catalog-pattern-001",
            matched_count: 12,
          },
          {
            path: "Card#title",
            kind: "symbol",
            value: "string",
            spec_id: "operator-console-001",
            matched_count: 8,
          },
        ];
      } else {
        mockResults = [
          {
            path: "maxNodeCount(200)",
            kind: "constraint",
            value: "violation in: gallery-ui-001",
            spec_id: "gallery-ui-001",
            matched_count: 1,
          },
          {
            path: "noForbiddenNames(['__private', '__internal'])",
            kind: "constraint",
            value: 0,
            spec_id: "catalog-pattern-001",
            matched_count: 0,
          },
          {
            path: "requiredMetadata(['title', 'description'])",
            kind: "constraint",
            value: "ok",
            spec_id: "operator-console-001",
            matched_count: 0,
          },
        ];
      }

      setResults(mockResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zero Query"
        subtitle="Graph query IDE — explore catalog nodes, symbols, constraints, metadata"
      />

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50/30 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {/* Query Interface */}
      <Card>
        <div className="space-y-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Query Editor
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                Query Type
              </label>
              <div className="flex gap-2">
                {(
                  ["jsonpath", "symbol", "constraint"] as const
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => setQueryType(type)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      queryType === type
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">
                {queryType === "jsonpath"
                  ? "JSONPath Expression"
                  : queryType === "symbol"
                    ? "Symbol Name"
                    : "Constraint Name"}
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  queryType === "jsonpath"
                    ? "/nodes/*/signal"
                    : queryType === "symbol"
                      ? "Stack#axis"
                      : "maxNodeCount(200)"
                }
                className="w-full px-3 py-2 rounded-md border border-border bg-background font-mono text-xs"
                rows={3}
                disabled={loading}
              />
            </div>

            <Button
              onClick={executeQuery}
              disabled={loading}
              className="w-full"
            >
              <Search className="h-4 w-4 mr-2" />
              Execute Query
            </Button>
          </div>

          {/* Query Examples */}
          <div className="bg-muted/30 rounded-md p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Examples
            </div>
            <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
              {queryType === "jsonpath" && (
                <>
                  <div>/structure/patterns[signal='chart']</div>
                  <div>/nodes[kind='stack']/children</div>
                  <div>/metadata/created_at</div>
                </>
              )}
              {queryType === "symbol" && (
                <>
                  <div>Stack#axis</div>
                  <div>Button#variant</div>
                  <div>Card#children</div>
                </>
              )}
              {queryType === "constraint" && (
                <>
                  <div>maxNodeCount(200)</div>
                  <div>noForbiddenNames</div>
                  <div>requiredMetadata</div>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card>
        <div className="space-y-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Results ({results.length})
          </div>

          {results.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {loading ? "Running query..." : "No results. Try executing a query above."}
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-md p-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-mono text-xs font-semibold mb-1">
                        {result.path}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {result.kind}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {result.spec_id}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold">
                        {result.matched_count} match{result.matched_count !== 1 ? "es" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {typeof result.value === "string"
                        ? result.value
                        : JSON.stringify(result.value, null, 2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Query Language Reference */}
      <Card className="bg-blue-50/5 border-blue-500/20">
        <div className="space-y-3 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Query Language Reference
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <div className="font-semibold text-primary">JSONPath</div>
              <div className="text-muted-foreground space-y-1 text-[10px]">
                <div>
                  <code className="bg-muted px-1">/nodes</code> — root nodes
                </div>
                <div>
                  <code className="bg-muted px-1">/nodes/*/signal</code> — any node's
                  signal
                </div>
                <div>
                  <code className="bg-muted px-1">
                    [key='value']
                  </code>{" "}
                  — filter by attribute
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-primary">Symbol Lookup</div>
              <div className="text-muted-foreground space-y-1 text-[10px]">
                <div>
                  <code className="bg-muted px-1">ComponentName#field</code> — find
                  symbol
                </div>
                <div>Find all references to a component or field</div>
                <div>Returns type information and constraints</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-primary">Constraints</div>
              <div className="text-muted-foreground space-y-1 text-[10px]">
                <div>Find constraint violations in catalog</div>
                <div>Check if nodes exceed limits</div>
                <div>Validate metadata requirements</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Integration Note */}
      <Card className="bg-green-50/5 border-green-500/20">
        <div className="space-y-2 text-sm">
          <div className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Zerolang Integration
          </div>
          <p className="text-xs text-muted-foreground">
            This query interface is a UI for the zerolang agent loop's{" "}
            <code className="bg-muted px-1 rounded">agent_query()</code> function. Agents
            use the same queries to explore specs, find patterns, and make informed
            patches.
          </p>
        </div>
      </Card>
    </div>
  );
}
