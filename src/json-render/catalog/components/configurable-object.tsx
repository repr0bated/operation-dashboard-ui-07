import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CognitiveAgent } from "@/types/api";
import { PageHeader, Pill, StatCard } from "@/components/shell/Primitives";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { El } from "./types";

const AGENTS_QUERY_KEY = ["cognitive-agents"] as const;
const EMPTY_AGENTS: CognitiveAgent[] = [];

function useCognitiveAgents() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: api.cognitiveAgents.list,
  });
}

function ConfigurableObjectPageFrame({
  title,
  subtitle,
  parentPlugin,
  overview,
  configuration,
}: {
  title: string;
  subtitle?: string;
  parentPlugin: string;
  overview: ReactNode;
  configuration: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Pill>parent · {parentPlugin}</Pill>
            <Pill variant="ok">LIVE DATA</Pill>
          </div>
        }
      />
      <Tabs defaultValue="overview" className="min-h-0">
        <TabsList className="h-9 border border-border bg-secondary/50 p-1">
          <TabsTrigger value="overview" className="h-7 text-xs">Overview</TabsTrigger>
          <TabsTrigger value="configuration" className="h-7 text-xs">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-3 min-h-0">{overview}</TabsContent>
        <TabsContent value="configuration" className="mt-3 min-h-0">{configuration}</TabsContent>
      </Tabs>
    </div>
  );
}

function QueryState({
  loading,
  error,
}: {
  loading: boolean;
  error: Error | null;
}) {
  if (loading) {
    return (
      <div className="flex h-28 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        Agent data is unavailable. {error.message}
      </div>
    );
  }
  return null;
}

function CognitiveAgentsOverview() {
  const query = useCognitiveAgents();
  const agents = query.data ?? EMPTY_AGENTS;
  const enabled = agents.filter((agent) => agent.enabled).length;
  const active = agents.filter((agent) => agent.active).length;
  const running = agents.filter((agent) => agent.running).length;

  const state = <QueryState loading={query.isLoading} error={query.error} />;
  if (query.isLoading || query.error) return state;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Available" value={agents.length} />
        <StatCard label="Enabled" value={enabled} variant="ok" />
        <StatCard label="Prewarmed" value={active} variant="ok" />
        <StatCard label="Running" value={running} variant={running < active ? "warn" : "ok"} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Child objects</h2>
          <p className="text-xs text-muted-foreground">Agent instances derived from the agent_config parent plugin.</p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{agents.length} objects</span>
      </div>
      {agents.length === 0 ? (
        <p className="rounded-lg border border-border p-5 text-sm text-muted-foreground">
          No cognitive agents are registered.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <article key={agent.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{agent.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                </div>
                <Pill variant={agent.running ? "ok" : agent.enabled ? "warn" : "default"}>
                  {agent.running ? "running" : agent.enabled ? "enabled" : "disabled"}
                </Pill>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.capabilities.map((capability) => (
                  <span key={capability} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {capability}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-[11px] font-mono text-muted-foreground">
                {agent.active ? "prewarmed" : "lazy start"}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type AgentDraft = Pick<CognitiveAgent, "enabled" | "active">;

function CognitiveAgentsConfiguration() {
  const queryClient = useQueryClient();
  const query = useCognitiveAgents();
  const agents = query.data ?? EMPTY_AGENTS;
  const [draft, setDraft] = useState<Record<string, AgentDraft>>({});

  useEffect(() => {
    setDraft(
      Object.fromEntries(
        agents.map((agent) => [agent.id, { enabled: agent.enabled, active: agent.active }]),
      ),
    );
  }, [agents]);

  const dirty = useMemo(
    () => agents.some((agent) => {
      const next = draft[agent.id];
      return next && (next.enabled !== agent.enabled || next.active !== agent.active);
    }),
    [agents, draft],
  );

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.cognitiveAgents.set({
        enabled_agent_ids: agents.filter((agent) => draft[agent.id]?.enabled).map((agent) => agent.id),
        active_agent_ids: agents.filter((agent) => draft[agent.id]?.active).map((agent) => agent.id),
      });
      if (!result.success) throw new Error(result.error || "The agent configuration was rejected.");
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      toast.success("Agent configuration saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const state = <QueryState loading={query.isLoading} error={query.error} />;
  if (query.isLoading || query.error) return state;

  const update = (agent: CognitiveAgent, patch: Partial<AgentDraft>) => {
    setDraft((current) => {
      const previous = current[agent.id] ?? { enabled: agent.enabled, active: agent.active };
      const next = { ...previous, ...patch };
      if (!next.enabled) next.active = false;
      return { ...current, [agent.id]: next };
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Agent availability</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enabled agents are exposed as tools. Active agents are prewarmed; other enabled agents start on demand.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(Object.fromEntries(agents.map((agent) => [agent.id, { enabled: agent.enabled, active: agent.active }])))}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {agents.map((agent) => {
          const value = draft[agent.id] ?? { enabled: agent.enabled, active: agent.active };
          return (
            <div key={agent.id} className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{agent.name}</div>
                <div className="truncate text-xs text-muted-foreground">{agent.description}</div>
              </div>
              <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                Enabled
                <Switch checked={value.enabled} disabled={save.isPending} onCheckedChange={(enabled) => update(agent, { enabled })} />
              </label>
              <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                Active
                <Switch checked={value.active} disabled={!value.enabled || save.isPending} onCheckedChange={(active) => update(agent, { active })} />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Agents page: one parent plugin, two page tabs, and its derived objects. */
export const CognitiveAgentsPageEl: El<"cognitiveAgentsPage"> = ({ props }) => (
  <ConfigurableObjectPageFrame
    title={props.title}
    subtitle={props.subtitle ?? undefined}
    parentPlugin="agent_config"
    overview={<CognitiveAgentsOverview />}
    configuration={<CognitiveAgentsConfiguration />}
  />
);
