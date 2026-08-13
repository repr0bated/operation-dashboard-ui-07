/**
 * Vectorization model picker — Embedding Pipeline's routing authority.
 * Reads GetModelAssignments.vectorization; applies SetVectorizationModel.
 * Options come from embedding_model listModels, not chat model_routes.
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
  EMBEDDING_SUBIDS,
  ZEROCLAW_SUBIDS,
  parseEmbeddingModels,
  vectorizationModelOptions,
} from "@/lib/zeroclaw-routing";
import { Loader2, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function VectorizationModelSelect({ className }: Props) {
  const { state, loading, error: loadError, refresh } = useZeroclawRouting();
  const [listed, setListed] = useState<string[]>([]);
  const [listing, setListing] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = state.assignments.vectorization;
  const models = vectorizationModelOptions(current, listed);

  useEffect(() => {
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
  }, []);

  const apply = async (modelId: string) => {
    setApplying(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      await pluginMethods.callSubid(ZEROCLAW_SUBIDS.setVectorizationModel, { modelId });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const busy = loading || listing || applying;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        value={current ?? undefined}
        onValueChange={(v) => void apply(v)}
        disabled={busy || models.length === 0}
      >
        <SelectTrigger className="h-8 w-[260px] text-xs font-mono" aria-label="Vectorization model">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Orbit className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue placeholder="Vectorization model…" />
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
