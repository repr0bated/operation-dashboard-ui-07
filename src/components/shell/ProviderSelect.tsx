/**
 * Model/provider picker — backed by zeroclaw's real provider catalog
 * (schema-driven; new providers registered there show up here automatically,
 * no hardcoded list). Populated from the schemars routing snapshot
 * (`ListProviders` + `GetRouter` / `GetState`), applied via `SetProvider`
 * (mut.service.zeroclaw.provider.set@v1).
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
import { ZEROCLAW_SUBIDS } from "@/lib/zeroclaw-routing";
import { Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function ProviderSelect({ className }: Props) {
  const { state, loading, error: loadError, refresh } = useZeroclawRouting();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providers = state.providers;
  const value = state.selected_provider ?? "";

  const apply = async (providerId: string) => {
    setApplying(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      await pluginMethods.callSubid(ZEROCLAW_SUBIDS.setProvider, { providerId });
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
        disabled={loading || applying || providers.length === 0}
      >
        <SelectTrigger className="h-8 w-[200px] text-xs font-mono">
          {loading || applying ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Cpu className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue placeholder="Provider…" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((id) => (
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
