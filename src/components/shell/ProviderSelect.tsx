/**
 * Model/provider picker — backed by 3tched-router's real provider catalog
 * (schema-driven; new providers registered there show up here automatically,
 * no hardcoded list). Populated via `ListProviders` + `GetRouter`
 * (obs.service.3tched-router.providers.list@v1 / obs.service.3tched-router.router.get@v1),
 * applied via `SetProvider` (mut.service.3tched-router.provider.set@v1).
 */
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { valueToJs } from "@/grpc/google/protobuf/struct";
import { Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TchedRouterProvider {
  id?: string;
  kind?: string;
  description?: string;
}

const FALLBACK_PROVIDER = "salad";

interface Props {
  className?: string;
}

export function ProviderSelect({ className }: Props) {
  const [providers, setProviders] = useState<TchedRouterProvider[]>([]);
  const [value, setValue] = useState<string>(FALLBACK_PROVIDER);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { pluginMethods } = await import("@/grpc/plugin-methods");
        const [providersResp, routerResp] = await Promise.all([
          pluginMethods.callSubid<object, { providers?: unknown[] }>(
            "obs.service.3tched-router.providers.list@v1",
            {},
          ),
          pluginMethods.callSubid<object, { router?: unknown }>(
            "obs.service.3tched-router.router.get@v1",
            {},
          ),
        ]);
        if (!alive) return;
        const list = (providersResp.providers ?? [])
          .map((p) => {
            const o = (valueToJs(p) ?? {}) as Record<string, unknown>;
            const id = o.id ?? o.provider_id ?? o.providerId ?? o.name;
            return {
              id: typeof id === "string" ? id : undefined,
              kind: typeof o.kind === "string" ? o.kind : undefined,
              description:
                typeof o.description === "string" ? o.description : undefined,
            } as TchedRouterProvider;
          })
          .filter((p): p is TchedRouterProvider & { id: string } => !!p.id);
        setProviders(list);
        const activeProvider = (valueToJs(routerResp.router) as { provider?: string } | undefined)
          ?.provider;
        const initial =
          activeProvider && list.some((p) => p.id === activeProvider)
            ? activeProvider
            : list.some((p) => p.id === FALLBACK_PROVIDER)
              ? FALLBACK_PROVIDER
              : (list[0]?.id ?? FALLBACK_PROVIDER);
        setValue(initial);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const apply = async (providerId: string) => {
    const prev = value;
    setValue(providerId);
    setApplying(true);
    setError(null);
    try {
      const { pluginMethods } = await import("@/grpc/plugin-methods");
      await pluginMethods.callSubid("mut.service.3tched-router.provider.set@v1", {
        providerId,
      });
    } catch (e) {
      setValue(prev);
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select value={value} onValueChange={(v) => void apply(v)} disabled={loading}>
        <SelectTrigger className="h-8 w-[200px] text-xs font-mono">
          {loading || applying ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Cpu className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
          )}
          <SelectValue placeholder="Provider…" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.id} value={p.id as string} className="text-xs font-mono">
              {p.id}
              {p.kind ? ` · ${p.kind}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <span className="text-[10px] text-danger font-mono">{error}</span>}
    </div>
  );
}
