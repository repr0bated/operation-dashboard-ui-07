import { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  Card,
  Pill,
  StatCard,
  StatusDot,
} from "@/components/shell/Primitives";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { assistantService } from "@/grpc/client";
import type {
  SoulMemory,
  MemoryNamespace,
  MemoryEntry,
  MemoryStats,
} from "@/grpc/types/assistant";
import {
  Loader2,
  Brain,
  Database,
  Tag,
  Clock,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";

export default function AssistantPage() {
  const [souls, setSouls] = useState<SoulMemory[]>([]);
  const [namespaces, setNamespaces] = useState<MemoryNamespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSoul, setSelectedSoul] = useState<SoulMemory | null>(null);
  const [editSoul, setEditSoul] = useState<SoulMemory | null>(null);
  const [editIdentity, setEditIdentity] = useState("");
  const [editPersonality, setEditPersonality] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [soulResp, nsResp] = await Promise.all([
        assistantService.listSoulMemories(),
        assistantService.listMemoryNamespaces(),
      ]);
      setSouls(soulResp.memories);
      setNamespaces(nsResp.namespaces);
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
    () => namespaces.reduce((s, n) => s + n.entryCount, 0),
    [namespaces],
  );

  async function handleUpdateSoul() {
    if (!editSoul) return;
    try {
      await assistantService.updateSoulMemory({
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
      await assistantService.deleteSoulMemory(agentId);
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
        subtitle="Soul memory, namespace bindings, and cognitive store"
      />

      {error && (
        <Card className="border-red-500/50 bg-red-500/10 p-3 text-red-400 text-sm">
          {error}
        </Card>
      )}

      {/* Stats */}
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

      {/* Soul Memory Table */}
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
                    key={s.agentId}
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
                      {Object.keys(s.traits).length} keys
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {s.updatedAt
                        ? new Date(s.updatedAt.seconds * 1000).toLocaleString()
                        : "—"}
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

      {/* Namespace Bindings Table */}
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
                  <th className="pb-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {namespaces.map((n) => (
                  <tr
                    key={`${n.agentId}-${n.namespace}`}
                    className="border-b hover:bg-muted/30"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{n.agentId}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {n.namespace}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary">{n.entryCount}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {n.createdAt
                        ? new Date(n.createdAt.seconds * 1000).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Soul Detail Dialog */}
      <Dialog open={!!selectedSoul} onOpenChange={() => setSelectedSoul(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soul Memory: {selectedSoul?.agentId}</DialogTitle>
            <DialogDescription>
              Full soul memory details and traits
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

      {/* Edit Soul Dialog */}
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
