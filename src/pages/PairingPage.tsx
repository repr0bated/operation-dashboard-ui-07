// Device pairing gate — shown when no Ghostbridge identity is available.
// Mirrors zeroclaw-gui AuthState: enter code from POST /admin/paircode/new,
// exchange via POST /pair, then attach footprint/trace to all gRPC calls.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, KeyRound, Shield } from "lucide-react";
import {
  generatePairingCode,
  pairWithCode,
  resolveIdentity,
  type PairSession,
} from "@/lib/identity";
import { resetTransport } from "@/grpc/client";

type Props = {
  reason?: string;
  onPaired: (session: PairSession) => void;
};

const PairingPage = ({ reason, onPaired }: Props) => {
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("dashboard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a pairing code.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setHint(null);
    try {
      const session = await pairWithCode(trimmed, deviceName.trim() || "dashboard");
      resetTransport();
      onPaired(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const mintCode = async () => {
    setSubmitting(true);
    setError(null);
    setHint(null);
    try {
      const minted = await generatePairingCode();
      setCode(minted);
      setHint("Code minted on this host — paste it above and Pair (expires in 5 minutes).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mint code.");
    } finally {
      setSubmitting(false);
    }
  };

  const retrySled = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const status = await resolveIdentity();
      if (status.state === "ready") {
        resetTransport();
        onPaired(status.identity);
      } else {
        setError(status.state === "needs_pairing" ? status.reason : "Still probing identity…");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identity probe failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pair this dashboard</CardTitle>
          <CardDescription>
            No Ghostbridge identity was found. Enter a pairing code from the
            host (mesh/localhost) to attach sled footprint + trace headers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {reason}
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Device name
              </label>
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pairing code
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                disabled={submitting}
                autoFocus
                className="font-mono tracking-widest"
                autoComplete="one-time-code"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {hint && (
              <p className="text-sm text-muted-foreground" role="status">
                {hint}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pairing…
                </>
              ) : (
                "Pair"
              )}
            </Button>
          </form>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={submitting}
              onClick={mintCode}
            >
              Generate new code (host/mesh)
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={submitting}
              onClick={retrySled}
            >
              <Shield className="mr-2 h-4 w-4" />
              Retry identity sled
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            On the host:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              curl -X POST http://127.0.0.1:8080/admin/paircode/new
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PairingPage;
