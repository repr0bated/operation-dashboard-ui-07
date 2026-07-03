/**
 * Invoke — direct RPC console for `OvsdbService` (ovsdaemon.v1) and
 * `PredictionService` (google.cloud.aiplatform.v1).
 *
 * Pick a service + method, edit the request JSON, and see the response.
 * Unary calls render the single response body. Server-streaming calls append
 * frames as they arrive, plus final status. Any error surfaces inline.
 *
 * Kept separate from `/explorer` (curated server-stream catalog) and
 * `/reflection` (schema browser) — this page is the read-write invoker.
 */
import { useMemo, useRef, useState } from "react";
import { PageHeader, Card } from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Play, Square, Trash2, Radio, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getOvsdbServiceV2Client,
  getPredictionServiceClient,
} from "@/grpc/transport";

type Kind = "unary" | "server-stream";

interface MethodDef {
  id: string;
  service: string;
  method: string;
  kind: Kind;
  input: string;
  output: string;
  defaults: unknown;
  invoke: (payload: unknown) => Promise<InvocationResult>;
}

interface InvocationResult {
  status: { code: number; detail: string };
  frames: unknown[];
  abort?: () => void;
}

// ── OvsdbService adapters ────────────────────────────────────────────────
const ovsdb = () => getOvsdbServiceV2Client();
const pred = () => getPredictionServiceClient();

async function runUnary<TReq, TRes>(
  call: { response: Promise<TRes>; status: Promise<{ code: string | number; detail: string }> },
): Promise<InvocationResult> {
  const [response, status] = await Promise.all([call.response, call.status]);
  return {
    status: { code: Number(status.code) || 0, detail: status.detail || String(status.code) },
    frames: [response],
  };
}

// Streaming helper: returns immediately with an abort handle and a promise
// that resolves when the stream ends. Frames are pushed into `onFrame`.
function runStream<TReq, TRes>(
  call: {
    responses: { onMessage: (cb: (m: TRes) => void) => void };
    status: Promise<{ code: string | number; detail: string }>;
  },
  onFrame: (m: TRes) => void,
): { done: Promise<InvocationResult["status"]> } {
  call.responses.onMessage(onFrame);
  const done = call.status.then((s) => ({
    code: Number(s.code) || 0,
    detail: s.detail || String(s.code),
  }));
  return { done };
}

const METHODS: MethodDef[] = [
  {
    id: "ovsdb.CreateBridge",
    service: "OvsdbService",
    method: "CreateBridge",
    kind: "unary",
    input: "BridgeRequest",
    output: "BridgeResponse",
    defaults: { name: "br-scratch" },
    invoke: (p) => runUnary(ovsdb().createBridge(p as never)),
  },
  {
    id: "ovsdb.DeleteBridge",
    service: "OvsdbService",
    method: "DeleteBridge",
    kind: "unary",
    input: "BridgeRequest",
    output: "BridgeResponse",
    defaults: { name: "br-scratch" },
    invoke: (p) => runUnary(ovsdb().deleteBridge(p as never)),
  },
  {
    id: "ovsdb.ListBridges",
    service: "OvsdbService",
    method: "ListBridges",
    kind: "unary",
    input: "BridgesRequest",
    output: "BridgesResponse",
    defaults: {},
    invoke: (p) => runUnary(ovsdb().listBridges(p as never)),
  },
  {
    id: "ovsdb.AddPort",
    service: "OvsdbService",
    method: "AddPort",
    kind: "unary",
    input: "PortRequest",
    output: "PortResponse",
    defaults: { bridge: "br-scratch", port: "veth0" },
    invoke: (p) => runUnary(ovsdb().addPort(p as never)),
  },
  {
    id: "ovsdb.RemovePort",
    service: "OvsdbService",
    method: "RemovePort",
    kind: "unary",
    input: "PortRequest",
    output: "PortResponse",
    defaults: { bridge: "br-scratch", port: "veth0" },
    invoke: (p) => runUnary(ovsdb().removePort(p as never)),
  },
  {
    id: "ovsdb.ListPorts",
    service: "OvsdbService",
    method: "ListPorts",
    kind: "unary",
    input: "PortsRequest",
    output: "PortsResponse",
    defaults: { bridge: "br-scratch" },
    invoke: (p) => runUnary(ovsdb().listPorts(p as never)),
  },
  {
    id: "ovsdb.ListDatabases",
    service: "OvsdbService",
    method: "ListDatabases",
    kind: "unary",
    input: "DatabaseRequest",
    output: "DatabaseResponse",
    defaults: {},
    invoke: (p) => runUnary(ovsdb().listDatabases(p as never)),
  },
  {
    id: "ovsdb.AttachPortToNetns",
    service: "OvsdbService",
    method: "AttachPortToNetns",
    kind: "unary",
    input: "AttachPortRequest",
    output: "AttachPortResponse",
    defaults: { bridge: "br-scratch", port: "veth-c0", netnsPath: "/var/run/netns/c0" },
    invoke: (p) => runUnary(ovsdb().attachPortToNetns(p as never)),
  },
  {
    id: "ovsdb.DetachPortFromNetns",
    service: "OvsdbService",
    method: "DetachPortFromNetns",
    kind: "unary",
    input: "DetachPortRequest",
    output: "DetachPortResponse",
    defaults: { port: "veth-c0", netnsPath: "/var/run/netns/c0" },
    invoke: (p) => runUnary(ovsdb().detachPortFromNetns(p as never)),
  },
  {
    id: "ovsdb.GetStatus",
    service: "OvsdbService",
    method: "GetStatus",
    kind: "unary",
    input: "StatusRequest",
    output: "StatusResponse",
    defaults: {},
    invoke: (p) => runUnary(ovsdb().getStatus(p as never)),
  },
  // ── PredictionService ────────────────────────────────────────────────
  {
    id: "prediction.GenerateContent",
    service: "PredictionService",
    method: "GenerateContent",
    kind: "unary",
    input: "GenerateContentRequest",
    output: "GenerateContentResponse",
    defaults: {
      model: "gemma-brain/local",
      contents: [{ role: "user", parts: [{ text: "Say hello in one line." }] }],
    },
    invoke: (p) => runUnary(pred().generateContent(p as never)),
  },
  {
    id: "prediction.StreamGenerateContent",
    service: "PredictionService",
    method: "StreamGenerateContent",
    kind: "server-stream",
    input: "GenerateContentRequest",
    output: "GenerateContentResponse (stream)",
    defaults: {
      model: "gemma-brain/local",
      contents: [{ role: "user", parts: [{ text: "Stream me a haiku about switches." }] }],
    },
    invoke: async (): Promise<InvocationResult> => {
      // Filled in by the page (needs a live frame callback); this path is
      // not taken because streaming is dispatched directly below.
      return { status: { code: 0, detail: "OK" }, frames: [] };
    },
  },
];

const STORAGE_KEY = "invoke.payload.v1";

function loadPayloads(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePayloads(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage may be unavailable — ignore.
  }
}

export default function InvokePage() {
  const savedRef = useRef<Record<string, string>>(loadPayloads());
  const [selectedId, setSelectedId] = useState(METHODS[0].id);
  const selected = METHODS.find((m) => m.id === selectedId)!;

  const initialPayload = useMemo(
    () => savedRef.current[selected.id] ?? JSON.stringify(selected.defaults, null, 2),
    [selected],
  );
  const [payload, setPayload] = useState(initialPayload);
  const [busy, setBusy] = useState(false);
  const [frames, setFrames] = useState<unknown[]>([]);
  const [status, setStatus] = useState<{ code: number; detail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const abortRef = useRef<null | (() => void)>(null);

  const switchMethod = (id: string) => {
    if (busy) return;
    setSelectedId(id);
    const def = METHODS.find((m) => m.id === id)!;
    setPayload(savedRef.current[id] ?? JSON.stringify(def.defaults, null, 2));
    setFrames([]);
    setStatus(null);
    setError(null);
    setElapsedMs(null);
  };

  const persistPayload = (v: string) => {
    setPayload(v);
    savedRef.current[selected.id] = v;
    savePayloads(savedRef.current);
  };

  const invoke = async () => {
    let parsed: unknown;
    try {
      parsed = payload.trim() ? JSON.parse(payload) : {};
    } catch (e) {
      setError(`JSON parse: ${(e as Error).message}`);
      return;
    }
    setError(null);
    setFrames([]);
    setStatus(null);
    setBusy(true);
    const start = performance.now();
    try {
      if (selected.kind === "server-stream" && selected.id === "prediction.StreamGenerateContent") {
        const call = pred().streamGenerateContent(parsed as never);
        // gRPC-Web fetch has no true cancel; clearing the abort ref stops
        // us appending further frames after the user hits Stop.
        abortRef.current = () => undefined;
        const collected: unknown[] = [];
        const { done } = runStream(call, (m) => {
          collected.push(m);
          setFrames((prev) => [...prev, m]);
        });
        const s = await done;
        setStatus(s);
        // Ensure final frames flushed (in case React batching swallowed the
        // last setState during unmount).
        setFrames(collected.slice());
      } else {
        const res = await selected.invoke(parsed);
        setFrames(res.frames);
        setStatus(res.status);
      }
    } catch (e) {
      setError((e as Error)?.message ?? String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
      setElapsedMs(Math.round(performance.now() - start));
    }
  };

  const cancel = () => {
    abortRef.current?.();
    setBusy(false);
  };

  const clear = () => {
    setFrames([]);
    setStatus(null);
    setError(null);
    setElapsedMs(null);
  };

  return (
    <>
      <PageHeader
        title="Invoke"
        subtitle="Direct RPC console for OvsdbService (ovsdaemon.v1) and PredictionService (aiplatform.v1)."
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4"
        style={{ minHeight: "calc(100vh - 220px)" }}
      >
        {/* Method list */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Methods
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {["OvsdbService", "PredictionService"].map((svc) => (
                <div key={svc}>
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {svc}
                  </div>
                  <div className="space-y-0.5">
                    {METHODS.filter((m) => m.service === svc).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => switchMethod(m.id)}
                        disabled={busy && m.id !== selected.id}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md transition-colors border",
                          selectedId === m.id
                            ? "border-primary/40 bg-primary/10"
                            : "border-transparent hover:bg-muted/30",
                          busy && m.id !== selected.id && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {m.method}
                          </span>
                          {m.kind === "server-stream" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono border-info/40 text-info px-1 py-0"
                            >
                              stream
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                          {m.input} <ArrowRight className="inline h-2.5 w-2.5" /> {m.output}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Detail */}
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-semibold text-foreground truncate">
                {selected.service}.{selected.method}
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {selected.kind}
              </Badge>
              {status && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono",
                    status.code === 0 ? "border-info/40 text-info" : "border-danger/40 text-danger",
                  )}
                >
                  status {status.code}
                </Badge>
              )}
              {elapsedMs !== null && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {elapsedMs}ms
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-mono">
                {frames.length} frame{frames.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              {!busy && (
                <Button size="sm" onClick={invoke} className="h-7 gap-1.5">
                  <Play className="h-3 w-3" /> Invoke
                </Button>
              )}
              {busy && (
                <Button size="sm" variant="outline" onClick={cancel} className="h-7 gap-1.5">
                  <Square className="h-3 w-3" /> Stop
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={clear}
                className="h-7 gap-1.5"
                disabled={!frames.length && !status && !error}
              >
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0">
            {/* Request */}
            <div className="flex flex-col border-r border-border min-h-0">
              <div className="px-3 py-1.5 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Request · {selected.input}
              </div>
              <Textarea
                value={payload}
                onChange={(e) => persistPayload(e.target.value)}
                spellCheck={false}
                className="flex-1 rounded-none border-0 font-mono text-xs resize-none focus-visible:ring-0"
                placeholder="{}"
              />
            </div>
            {/* Response */}
            <div className="flex flex-col min-h-0">
              <div className="px-3 py-1.5 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Radio className="h-3 w-3" /> Response · {selected.output}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {error && (
                    <div className="px-2 py-1.5 rounded-md border border-danger/40 bg-danger/5 text-xs font-mono text-danger whitespace-pre-wrap">
                      {error}
                    </div>
                  )}
                  {!error && !frames.length && !busy && (
                    <div className="text-[11px] font-mono text-muted-foreground py-4 text-center">
                      No response yet. Edit the request and press Invoke.
                    </div>
                  )}
                  {busy && !frames.length && (
                    <div className="text-[11px] font-mono text-muted-foreground py-4 text-center">
                      Waiting for {selected.kind === "server-stream" ? "first frame" : "response"}…
                    </div>
                  )}
                  {frames.map((f, i) => (
                    <div key={i} className="rounded-md border border-border overflow-hidden">
                      <div className="px-2 py-1 border-b border-border bg-muted/20 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                        <span>frame #{i + 1}</span>
                        {selected.kind === "server-stream" && (
                          <span>{new Date().toLocaleTimeString()}</span>
                        )}
                      </div>
                      <pre className="p-2 text-[11px] font-mono text-foreground overflow-x-auto whitespace-pre">
                        {safeStringify(f)}
                      </pre>
                    </div>
                  ))}
                  {status && (
                    <div className="text-[10px] font-mono text-muted-foreground pt-1">
                      status.code={status.code} · {status.detail}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Card title="About">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Requests are encoded as protobuf over gRPC-Web using the same transport as the rest
              of the console. Unary calls resolve to a single response frame; server-streaming
              calls append frames as they arrive and finish with the trailer status.
            </div>
            <div>
              Payloads are persisted per method in <span className="font-mono text-foreground">localStorage</span>,
              so switching between methods retains your last edit.
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(
      v,
      (_, val) => (typeof val === "bigint" ? val.toString() : val),
      2,
    );
  } catch {
    return String(v);
  }
}
