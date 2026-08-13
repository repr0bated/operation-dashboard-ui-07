/**
 * Model picker — backed by zeroclaw's schemars routing schema and live
 * GetModelRoutes / GetState projection. Applied via SetModel
 * (mut.service.zeroclaw.model.set@v1).
 */
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZeroclawRouting } from "@/hooks/use-zeroclaw-routing";
import { ZEROCLAW_SUBIDS, selectableModels } from "@/lib/zeroclaw-routing";
import { Box, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function ModelSelect({ className }: Props) {
  const { state, loading, refresh } = useZeroclawRouting();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const models = selectableModels(state);
  const value = state.selected_model ?? "";

  const apply = async (modelId: string) => {
    setApplying(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      await pluginMethods.callSubid(ZEROCLAW_SUBIDS.setModel, { modelId });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select
        value={value || undefined}
        onValueChange={(v) => void apply(v)}
        disabled={loading || applying || models.length === 0}
      >
        <SelectTrigger className="h-8 w-[220px] text-xs font-mono">
          {loading || applying ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Box className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue placeholder="Model…" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-xs font-mono">
              {m.id}
              {m.name ? ` · ${m.name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-[10px] text-danger font-mono">{error}</span>}
    </div>
  );
}
