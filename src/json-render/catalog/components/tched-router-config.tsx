import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { SchemaRenderer } from "@/components/json/SchemaRenderer";
import { Pill } from "@/components/shell/Primitives";
import { cn } from "@/lib/utils";
import rootSchema from "@/json-render/tched-router/tched-router-config.schema.json";
import {
  asRootSchema,
  loadConfig,
  saveSection,
} from "@/json-render/tched-router/config-client";
import {
  listSections,
  lookupSectionValue,
} from "@/json-render/tched-router/config-schema";
import { MapKeyList } from "./map-key-list";
import type { JsonSchema } from "@/types/api";
import type { El } from "./types";

const MAP_KEY_SECTIONS: Record<string, { title: string; addLabel: string; naturalKey: string }> = {
  model_routes: {
    title: "Model routes",
    addLabel: "hint (e.g. reasoning) — not an MCP server",
    naturalKey: "hint",
  },
  embedding_routes: {
    title: "Embedding routes",
    addLabel: "hint (e.g. semantic)",
    naturalKey: "hint",
  },
};

const QUERY_KEY = ["tched-router-config"] as const;

export const TchedRouterConfigEl: El<"tchedRouterConfig"> = ({ props }) => {
  const sections = useMemo(() => listSections(asRootSchema(rootSchema)), []);
  const [activeKey, setActiveKey] = useState(sections[0]?.key ?? "gateway");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const queryClient = useQueryClient();

  const live = useQuery({
    queryKey: QUERY_KEY,
    queryFn: loadConfig,
  });

  const active = sections.find((section) => section.key === activeKey) ?? sections[0];
  const liveValue = lookupSectionValue(live.data, active?.key ?? "");
  const draft = active && active.key in drafts ? drafts[active.key] : liveValue;
  const dirty = active ? active.key in drafts : false;

  const filtered = sections.filter((section) => {
    const haystack = `${section.key} ${section.label} ${section.description ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!active || !live.data) throw new Error("config is not loaded");
      await saveSection(active.key, draft, live.data);
    },
    onSuccess: async () => {
      toast.success(`Saved ${active?.label ?? "section"}`);
      setDrafts((current) => {
        if (!active) return current;
        const next = { ...current };
        delete next[active.key];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="flex h-full min-h-[28rem] flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{props.title}</div>
          {props.subtitle ? (
            <div className="truncate text-[11px] text-muted-foreground">{props.subtitle}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Pill>plugin · tched_router</Pill>
          <Pill variant={live.isError ? "danger" : "ok"}>
            {live.isError ? "UNAVAILABLE" : "LIVE SCHEMA"}
          </Pill>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex min-h-0 flex-col border-r border-border bg-secondary/30">
          <div className="border-b border-border p-2.5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter sections"
                className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-2 text-xs outline-none focus:border-ring"
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filtered.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveKey(section.key)}
                className={cn(
                  "mb-0.5 w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors",
                  section.key === active?.key
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                )}
              >
                <div>{section.label}</div>
                <div className="truncate font-mono text-[10px] opacity-70">{section.key}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-xs text-muted-foreground">No matching sections.</p>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3">
            <div>
              <div className="text-base font-semibold">{active?.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground">{active?.key}</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!dirty || save.isPending}
                onClick={() => {
                  if (!active) return;
                  setDrafts((current) => {
                    const next = { ...current };
                    delete next[active.key];
                    return next;
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button
                type="button"
                disabled={!dirty || save.isPending || live.isError}
                onClick={() => save.mutate()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                {save.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {live.isLoading && (
              <div className="flex h-28 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {live.isError && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                Could not load tched_router config. {live.error.message}
              </div>
            )}
            {active && !live.isLoading && (
              <SectionEditor
                sectionKey={active.key}
                schema={active.schema}
                data={draft}
                onChange={(value) => {
                  setDrafts((current) => ({ ...current, [active.key]: value }));
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function SectionEditor({
  sectionKey,
  schema,
  data,
  onChange,
}: {
  sectionKey: string;
  schema: JsonSchema;
  data: unknown;
  onChange: (value: unknown) => void;
}) {
  const mapKey = MAP_KEY_SECTIONS[sectionKey];
  if (mapKey) {
    const items = Array.isArray(data)
      ? data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      : [];
    return (
      <MapKeyList
        title={mapKey.title}
        addLabel={mapKey.addLabel}
        naturalKey={mapKey.naturalKey}
        items={items}
        itemSchema={(schema.items as JsonSchema) ?? { type: "object", properties: {} }}
        onChange={onChange}
      />
    );
  }

  if (sectionKey === "mcp") {
    const record = data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
    const servers = Array.isArray(record.servers)
      ? record.servers.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      : [];
    const { servers: _servers, ...restSchemaProps } = schema.properties ?? {};
    return (
      <div className="space-y-5">
        <SchemaRenderer
          schema={{ ...schema, properties: restSchemaProps }}
          data={record}
          onChange={(next) => {
            const nextRecord = next && typeof next === "object" && !Array.isArray(next)
              ? (next as Record<string, unknown>)
              : record;
            onChange({ ...nextRecord, servers });
          }}
        />
        <MapKeyList
          title="MCP servers"
          addLabel="MCP server (tool prefix, e.g. filesystem)"
          naturalKey="name"
          items={servers}
          itemSchema={(schema.properties?.servers?.items as JsonSchema) ?? { type: "object", properties: {} }}
          onChange={(nextServers) => onChange({ ...record, servers: nextServers })}
        />
        <p className="text-[11px] text-muted-foreground">
          Existing aliases only (compact, agents). New MCP names cannot be created here.
        </p>
      </div>
    );
  }

  return <SchemaRenderer schema={schema} data={data} onChange={onChange} />;
}
