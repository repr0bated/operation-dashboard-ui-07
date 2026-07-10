// Public registration page — magic-link signup for the privacy network.
//
// Unlike every other page, this renders OUTSIDE AppShell: it is a public
// surface reached via https://registration.3tched.com/register with no
// dashboard chrome. It talks only to POST /api/privacy/signup; the emailed
// link lands on the server-rendered /privacy/verify flow, so no client-side
// verification state exists here.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";

const RESEND_COOLDOWN_S = 60; // matches the server-side rate limit

type Phase = "form" | "sent";

const RegisterPage = () => {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setInterval(
      () => setCooldown((s) => (s > 1 ? s - 1 : 0)),
      1000,
    );
    return () => clearInterval(timerRef.current);
  }, [cooldown > 0]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        setPhase("sent");
        setCooldown(RESEND_COOLDOWN_S);
      } else if (res.status === 429) {
        setError(
          body?.message ??
            "Too many requests — wait a minute before trying again.",
        );
        setCooldown(RESEND_COOLDOWN_S);
      } else {
        setError(body?.message ?? "Signup failed. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join the privacy network</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a sign-in link. No
            password needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phase === "form" ? (
            <form onSubmit={submit} className="space-y-4">
              <Input
                type="email"
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || (cooldown > 0 && phase === "form" && !!error)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link…
                  </>
                ) : (
                  "Send magic link"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">
                  {email.trim().toLowerCase()}
                </span>
                . Open it on this device to finish setting up your access.
              </p>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button
                variant="outline"
                className="w-full"
                disabled={cooldown > 0 || submitting}
                onClick={() => submit()}
              >
                {cooldown > 0 ? `Resend link (${cooldown}s)` : "Resend link"}
              </Button>
            </div>
          )}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            The link expires after a short time and can only be used once.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
