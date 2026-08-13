/**
 * Per-role zeroclaw assignment picker.
 * Vectorization options come from embedding_model listModels; every other
 * role uses chat model_routes. Applied via the role's Set*Model RPC.
 */
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import {
  ASSIGNMENT_META,
  ASSIGNMENT_SETTERS,
  EMBEDDING_SUBIDS,
  parseEmbeddingModels,
  vectorizationModelOptions,
  type AssignmentRole,
} from "@/lib/zeroclaw-routing";
import { Loader2, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  role: AssignmentRole;
  className?: string;
}

export function AssignmentModelSelect({ role, className }: Props) {
  const { state, loading, error: loadError, refresh } = useZeroclawRouting();
  const meta = ASSIGNMENT_META[role];
  const [listed, setListed] = useState<string[]>([]);
  const [listing, setListing] = useState(meta.catalog === "embedding");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = state.assignments[role];
  const routeIds = state.model_routes.map((m) => m.id).filter(Boolean);
  const models = vectorizationModelOptions(
    current,
    meta.catalog === "embedding" ? listed : routeIds,
  );

  useEffect(() => {
    if (meta.catalog !== "embedding") {
      setListing(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setListing(true);
      try {
        const { pluginMethods } = await import("@/grpc/plugin-methods");
        const raw = await pluginMethods.callSubid(EMBEDDING_SUBIDS.listModels, {});
        if (!cancelled) setListed(parseEmbeddingModels(raw));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setListing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta.catalog]);

  const apply = async (modelId: string) => {
    setApplying(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      await pluginMethods.callSubid(ASSIGNMENT_SETTERS[role], { modelId });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const busy = loading || listing || applying;
  const label = `${meta.label} model`;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        value={current ?? undefined}
        onValueChange={(v) => void apply(v)}
        disabled={busy || models.length === 0}
      >
        <SelectTrigger className="h-8 w-[260px] text-xs font-mono" aria-label={label}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Box className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue placeholder={`${meta.label}…`} />
        </SelectTrigger>
        <SelectContent>
          {models.map((id) => (
            <SelectItem key={id} value={id} className="text-xs font-mono">
              {id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(error || loadError) && (
        <span className="text-[10px] text-danger font-mono">{error ?? loadError}</span>
      )}
    </div>
  );
}
