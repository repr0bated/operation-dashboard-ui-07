import { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  Card,
  StatCard,
} from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  chatbotCognitive,
  type ChatbotSoul,
  type ChatbotNamespace,
} from "@/grpc/chatbot-cognitive";
import { PluginSchemaPanel } from "@/components/ui-model/PluginSchemaPanel";
import { ProviderSelect } from "@/components/shell/ProviderSelect";
import {
  ASSISTANT_ACCOUNT,
  getAccountInternetEnabled,
  setAccountInternetEnabled,
} from "@/lib/accounts";
import {
  Loader2,
  Brain,
  Database,
  Tag,
  Edit,
  Trash2,
  Fingerprint,
} from "lucide-react";

export default function AssistantPage() {
  const [souls, setSouls] = useState<ChatbotSoul[]>([]);
  const [namespaces, setNamespaces] = useState<ChatbotNamespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSoul, setSelectedSoul] = useState<ChatbotSoul | null>(null);
  const [editSoul, setEditSoul] = useState<ChatbotSoul | null>(null);
  const [editIdentity, setEditIdentity] = useState("");
  const [editPersonality, setEditPersonality] = useState("");
  const [internetEnabled, setInternetEnabled] = useState(() =>
    getAccountInternetEnabled(ASSISTANT_ACCOUNT),
  );

  function onInternetToggle(next: boolean) {
    setAccountInternetEnabled(ASSISTANT_ACCOUNT, next);
    setInternetEnabled(next);
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [soulList, nsList] = await Promise.all([
        chatbotCognitive.listSouls(),
        chatbotCognitive.listNamespaces(),
      ]);
      setSouls(soulList);
      setNamespaces(nsList);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const totalEntries = useMemo(
    () => namespaces.reduce((s, n) => s + Number(n.entryCount), 0),
    [namespaces],
  );

  async function handleUpdateSoul() {
    if (!editSoul) return;
    try {
      await chatbotCognitive.updateSoul({
        agentId: editSoul.agentId,
        identity: editIdentity || undefined,
        personality: editPersonality || undefined,
      });
      setEditSoul(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDeleteSoul(agentId: string) {
    try {
      await chatbotCognitive.deleteSoul(agentId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant Gateway"
        subtitle="Soul memory and namespaces via cognitive_mcp, bound to the chatbot account"
        actions={<ProviderSelect />}
      />

      <Card className="border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-start gap-3">
          <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1 text-sm">
            <div className="font-medium text-foreground">
              Acting as {ASSISTANT_ACCOUNT.label}
              <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                {ASSISTANT_ACCOUNT.role}
              </Badge>
              <Badge variant="outline" className="ml-2 text-[10px]">
                no execution
              </Badge>
              <Badge
                variant="outline"
                className={
                  internetEnabled
                    ? "ml-2 text-[10px] border-warn/40 text-warn"
                    : "ml-2 text-[10px]"
                }
              >
                {internetEnabled ? "internet on" : "no internet"}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {ASSISTANT_ACCOUNT.guardrail.summary} Lifelong account sessid
              (container = identity). Soul / namespace memory use{" "}
              <span className="font-mono">cognitive_mcp</span> — not legacy{" "}
              <span className="font-mono">assistant.v1</span>.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {ASSISTANT_ACCOUNT.guardrail.roles.map((r) => (
                <Badge key={r} variant="secondary" className="font-mono text-[10px]">
                  {r}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border/50 bg-background/40 px-3 py-2">
              <div className="min-w-0">
                <Label htmlFor="chatbot-internet" className="text-xs font-medium">
                  Public internet
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Production stays off (mesh / ghostbridge only). Turn on only for lab
                  debugging — network enforcement of the off state lands with the
                  capability gate.
                </p>
              </div>
              <Switch
                id="chatbot-internet"
                checked={internetEnabled}
                onCheckedChange={onInternetToggle}
                aria-label="Chatbot public internet"
              />
            </div>
            <dl className="grid gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="inline text-muted-foreground/70">sessid </dt>
                <dd className="inline break-all text-foreground/90">{ASSISTANT_ACCOUNT.sessionId}</dd>
              </div>
              <div>
                <dt className="inline text-muted-foreground/70">mesh </dt>
                <dd className="inline text-foreground/90">{ASSISTANT_ACCOUNT.meshIp}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="inline text-muted-foreground/70">pubkey </dt>
                <dd className="inline break-all text-foreground/90">{ASSISTANT_ACCOUNT.pubkey}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10 p-3 text-red-400 text-sm">
          {error}
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Soul Memories"
          value={souls.length}
          icon={<Brain className="h-4 w-4" />}
        />
        <StatCard
          label="Namespaces"
          value={namespaces.length}
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          label="Total Entries"
          value={totalEntries}
          icon={<Tag className="h-4 w-4" />}
        />
      </div>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Brain className="h-5 w-5" /> Antigravity Chat Schema
        </h3>
        <PluginSchemaPanel plugin="antigravity_chat" title="antigravity-chat blob schema" />
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Brain className="h-5 w-5" /> Soul Memories
        </h3>
        {souls.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No soul memories registered.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Agent</th>
                  <th className="pb-2 pr-4">Identity</th>
                  <th className="pb-2 pr-4">Personality</th>
                  <th className="pb-2 pr-4">Version</th>
                  <th className="pb-2 pr-4">Traits</th>
                  <th className="pb-2 pr-4">Updated</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {souls.map((s) => (
                  <tr
                    key={s.namespace}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedSoul(s)}
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{s.agentId}</td>
                    <td className="py-2 pr-4 max-w-[200px] truncate">
                      {s.identity || "—"}
                    </td>
                    <td className="py-2 pr-4 max-w-[200px] truncate">
                      {s.personality || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline">v{s.version}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {Object.keys(s.traits ?? {}).length} keys
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditSoul(s);
                          setEditIdentity(s.identity);
                          setEditPersonality(s.personality);
                        }}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSoul(s.agentId);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Database className="h-5 w-5" /> Namespace Bindings
        </h3>
        {namespaces.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No namespace bindings.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Agent</th>
                  <th className="pb-2 pr-4">Namespace</th>
                  <th className="pb-2 pr-4">Entries</th>
                </tr>
              </thead>
              <tbody>
                {namespaces.map((n) => (
                  <tr key={n.name} className="border-b hover:bg-muted/30">
                    <td className="py-2 pr-4 font-mono text-xs">{n.agentId}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{n.name}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">{n.entryCount}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedSoul} onOpenChange={() => setSelectedSoul(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soul Memory: {selectedSoul?.agentId}</DialogTitle>
            <DialogDescription>
              Account-scoped soul via cognitive_mcp ({selectedSoul?.namespace})
            </DialogDescription>
          </DialogHeader>
          {selectedSoul && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Identity:</span>{" "}
                {selectedSoul.identity || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Personality:</span>{" "}
                {selectedSoul.personality || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Version:</span>{" "}
                {selectedSoul.version}
              </div>
              <div>
                <span className="text-muted-foreground">Traits:</span>
                <pre className="mt-1 bg-muted p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedSoul.traits, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSoul} onOpenChange={() => setEditSoul(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Soul: {editSoul?.agentId}</DialogTitle>
            <DialogDescription>
              Update identity and personality for this agent
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Identity</label>
              <input
                className="w-full mt-1 p-2 bg-muted rounded border"
                value={editIdentity}
                onChange={(e) => setEditIdentity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Personality
              </label>
              <textarea
                className="w-full mt-1 p-2 bg-muted rounded border"
                rows={3}
                value={editPersonality}
                onChange={(e) => setEditPersonality(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded bg-muted hover:bg-muted/80"
                onClick={() => setEditSoul(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleUpdateSoul}
              >
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
