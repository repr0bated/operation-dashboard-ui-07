import { useCallback, useEffect, useMemo, useState } from "react";
import type { Spec } from "@json-render/core";
import { Eye, RefreshCw, X } from "lucide-react";
import { PageHeader, Card, Callout } from "@/components/shell/Primitives";
import { EmptyState, ErrorBanner } from "@/components/shell/Feedback";
import { SpecRenderer } from "@/components/ui-model/SpecRenderer";
import { ProviderSelect } from "@/components/shell/ProviderSelect";
import { valueToJs } from "@/grpc/google/protobuf/struct";
import {
  fetchAntigravityGalleryBundle,
  fetchPluginSchema,
  isRenderableGalleryPlugin,
  pluginIdFromBlobRenderCatalogId,
  sealedPluginSpec,
} from "@/lib/plugin-ui-surfaces";

import { resolveApiBase } from "@/lib/api";

type SourceId = "catalog" | "inference" | "antigravity";

interface SpecEntry {
  id: string;
  source: SourceId;
  spec: Spec;
  prompt?: string;
  tags?: string[];
  created_at?: number;
  /** Only catalog-backed entries can be promoted / deleted. */
  managed: boolean;
}

interface SourceState {
  status: "loading" | "ok" | "unimplemented" | "denied" | "error";
  message?: string;
  count: number;
}

const SOURCE_LABEL: Record<SourceId, string> = {
  catalog: "Gallery catalog (REST)",
  inference: "UI model (active inference provider)",
  antigravity: "Antigravity UI (sealed projection)",
};

const POLL_MS = 15000;

function classifyError(e: unknown): SourceState {
  const message = e instanceof Error ? e.message : String(e);
  // grpc-status 7 = PERMISSION_DENIED — identity accepted, capability not granted.
  if (/permission_denied|accessdenied|access denied|requires capability/i.test(message)) {
    return { status: "denied", message, count: 0 };
  }
  // grpc-status 12 = UNIMPLEMENTED — the service is advertised but not served.
  if (/\b12\b/.test(message) && /unimplemented|status/i.test(message)) {
    return { status: "unimplemented", message, count: 0 };
  }
  if (/unimplemented/i.test(message)) return { status: "unimplemented", message, count: 0 };
  return { status: "error", message, count: 0 };
}

function StatusChip({ id, state }: { id: SourceId; state: SourceState }) {
  const tone =
    state.status === "ok"
      ? "border-primary/40 text-primary bg-primary/10"
      : state.status === "loading"
        ? "border-border text-muted-foreground bg-muted/20"
        : state.status === "unimplemented" || state.status === "denied"
          ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
          : "border-destructive/40 text-destructive bg-destructive/10";
  const label =
    state.status === "ok"
      ? state.count === 0 ? "no spec returned" : `${state.count} spec${state.count === 1 ? "" : "s"}`
      : state.status === "loading"
        ? "probing…"
        : state.status === "unimplemented"
          ? "not served"
          : state.status === "denied"
            ? "capability denied"
            : "unreachable";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-mono ${tone}`}
      title={state.message}
    >
      <span className="opacity-70">{SOURCE_LABEL[id]}</span>
      <span className="font-semibold">{label}</span>
    </div>
  );
}

export default function GalleryPage() {
  const [entries, setEntries] = useState<Record<SourceId, SpecEntry[]>>({
    catalog: [],
    inference: [],
    antigravity: [],
  });
  const [sources, setSources] = useState<Record<SourceId, SourceState>>({
    catalog: { status: "loading", count: 0 },
    inference: { status: "loading", count: 0 },
    antigravity: { status: "loading", count: 0 },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SpecEntry | null>(null);

  const setSource = (id: SourceId, state: SourceState) =>
    setSources((prev) => ({ ...prev, [id]: state }));

  const loadCatalog = useCallback(async () => {
    try {
      const r = await fetch(`${resolveApiBase()}/ui-model/gallery`);
      if (!r.ok) throw new Error(`gallery HTTP ${r.status}`);
      const g = (await r.json()) as { specs?: Array<Omit<SpecEntry, "source" | "managed">> };
      const hydrated = await Promise.all(
        (g.specs ?? []).map(async (entry) => {
          const plugin = pluginIdFromBlobRenderCatalogId(entry.id);
          if (plugin && !isRenderableGalleryPlugin(plugin)) {
            return null;
          }
          if (!plugin) {
            return { ...entry, source: "catalog" as const, managed: true };
          }
          try {
            const envelope = await fetchPluginSchema(plugin);
            return {
              ...entry,
              source: "catalog" as const,
              managed: true,
              spec: sealedPluginSpec(plugin, envelope),
              prompt:
                entry.prompt ??
                `Hydrated from sealed ${plugin} blob · ${envelope.schema_hash?.slice(0, 12) ?? "live"}`,
            };
          } catch {
            return { ...entry, source: "catalog" as const, managed: true };
          }
        }),
      );
      const list = hydrated.filter((entry): entry is SpecEntry => entry !== null);
      setEntries((prev) => ({ ...prev, catalog: list }));
      setSource("catalog", { status: "ok", count: list.length });
    } catch (e) {
      setEntries((prev) => ({ ...prev, catalog: [] }));
      setSource("catalog", classifyError(e));
    }
  }, []);

  const loadInferenceSpec = useCallback(async () => {
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      const out = await pluginMethods.callSubid<
        Record<string, never>,
        { spec?: unknown }
      >("obs.service.gemma.ui-spec.get@v1", {});
      const spec = valueToJs(out.spec as never) as unknown as Spec | null;
      const list: SpecEntry[] = spec
        ? [{ id: "ui-model/get_ui_spec", source: "inference", spec, managed: false }]
        : [];
      setEntries((prev) => ({ ...prev, inference: list }));
      setSource("inference", {
        status: "ok",
        count: list.length,
        message: list.length === 0 ? "GetUiSpec returned no active surface" : undefined,
      });
    } catch (e) {
      setEntries((prev) => ({ ...prev, inference: [] }));
      setSource("inference", classifyError(e));
    }
  }, []);

  const loadAntigravity = useCallback(async () => {
    try {
      const bundle = await fetchAntigravityGalleryBundle();
      const list: SpecEntry[] = bundle.surfaces.map((surface) => ({
        id: surface.id,
        source: "antigravity" as const,
        spec: surface.spec,
        managed: false,
        prompt: bundle.schema_hash
          ? `${surface.name} · ${surface.schema} · JsonRenderer · ${bundle.schema_hash.slice(0, 12)}`
          : `${surface.name} · ${surface.schema} · JsonRenderer`,
      }));
      setEntries((prev) => ({ ...prev, antigravity: list }));
      setSource("antigravity", { status: "ok", count: list.length });
    } catch (e) {
      setEntries((prev) => ({ ...prev, antigravity: [] }));
      setSource("antigravity", classifyError(e));
    }
  }, []);


  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([loadCatalog(), loadInferenceSpec(), loadAntigravity()]);
    setRefreshing(false);
  }, [loadCatalog, loadInferenceSpec, loadAntigravity]);

  useEffect(() => {
    void refreshAll();
    const t = setInterval(() => void refreshAll(), POLL_MS);
    return () => clearInterval(t);
  }, [refreshAll]);

  const all = useMemo(
    () => [...entries.catalog, ...entries.inference, ...entries.antigravity],
    [entries],
  );

  const anyLive = (Object.keys(sources) as SourceId[]).some(
    (k) => sources[k].status === "ok",
  );
  const stillLoading = (Object.keys(sources) as SourceId[]).some(
    (k) => sources[k].status === "loading",
  );

  const promote = async (id: string) => {
    setBusy(id);
    setActionError(null);
    try {
      const r = await fetch(`${resolveApiBase()}/ui-model/catalog/promote/${id}`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`promote HTTP ${r.status}`);
      setEntries((prev) => ({ ...prev, catalog: prev.catalog.filter((s) => s.id !== id) }));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setActionError(null);
    try {
      const r = await fetch(`${resolveApiBase()}/ui-model/gallery/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error(`delete HTTP ${r.status}`);
      setEntries((prev) => ({ ...prev, catalog: prev.catalog.filter((s) => s.id !== id) }));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="UI Model Gallery"
        subtitle="Live json-render specs from the gallery catalog, the active inference model and the Antigravity plugin surface."
        actions={
          <div className="flex items-center gap-2">
            <ProviderSelect />
            <button
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] hover:bg-muted/30 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(SOURCE_LABEL) as SourceId[]).map((id) => (
          <StatusChip key={id} id={id} state={sources[id]} />
        ))}
      </div>

      <Callout variant="default">
        Gallery is the spec workbench: use <span className="font-medium">View rendering</span> to mount a surface.
        Antigravity surfaces come from the sealed <span className="font-mono">antigravity</span> projection
        (<span className="font-mono">ui_surfaces</span>, <span className="font-mono">JsonRenderer</span>).
        The backend <span className="font-mono">antigravity_chat</span> plugin has no UI surfaces of its own.
      </Callout>

      {actionError && <ErrorBanner title="Action failed" message={actionError} />}

      {!stillLoading && all.length === 0 && !anyLive && (
        <ErrorBanner
          title="No spec source is serving"
          message={(Object.keys(sources) as SourceId[])
            .map((k) => `${SOURCE_LABEL[k]}: ${sources[k].message ?? sources[k].status}`)
            .join(" · ")}
        />
      )}

      {!stillLoading && all.length === 0 && anyLive && (
        <EmptyState
          title="No specs available"
          hint="No source returned a surface. Antigravity routes come from its sealed projection; the inference source requires its model plugin's read capability."
        />
      )}

      {stillLoading && all.length === 0 && (
        <Callout variant="default">Probing spec sources…</Callout>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {all.map((entry) => (
          <Card
            key={`${entry.source}:${entry.id}`}
            title={entry.id}
            actions={
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreview(entry)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Eye className="h-3 w-3" /> View rendering
                </button>
                {entry.managed ? (
                <div className="flex gap-1.5">
                  <button
                    disabled={busy === entry.id}
                    onClick={() => void promote(entry.id)}
                    className="px-2 py-1 text-[11px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Promote
                  </button>
                  <button
                    disabled={busy === entry.id}
                    onClick={() => void remove(entry.id)}
                    className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-muted/30 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
                ) : (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {entry.source}
                  </span>
                )}
              </div>
            }
          >
            <div className="rounded-md border border-border bg-background/40 p-2 max-h-[360px] overflow-auto">
              <SpecRenderer spec={entry.spec} />
            </div>
            {entry.prompt && (
              <p className="mt-2 text-[11px] text-muted-foreground line-clamp-3">{entry.prompt}</p>
            )}
          </Card>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm p-4 md:p-8" role="dialog" aria-modal="true">
          <div className="mx-auto flex h-full max-w-5xl flex-col rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{preview.id}</div>
                <div className="text-[11px] text-muted-foreground">{SOURCE_LABEL[preview.source]} · live rendering</div>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground" aria-label="Close rendering preview">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <SpecRenderer spec={preview.spec} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
