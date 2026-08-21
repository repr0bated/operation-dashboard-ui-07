// Dashboard SPA. Identity gate, then the json-render shell.
// Live Chat / Catalog / Gallery / Stream pages are page specs, not generated gRPC pages.
import { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEventStream } from "@/json-render/stream/use-event-stream";
import { ShellRenderer, PageSpecOutlet } from "@/json-render";
import RegisterPage from "./pages/RegisterPage";
import PairingPage from "./pages/PairingPage";
import ChatOnlyPage from "./pages/ChatOnlyPage";
import {
  resolveIdentity,
  type IdentityStatus,
  type PairSession,
} from "@/lib/identity";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000, refetchOnWindowFocus: false },
  },
});

function ShellRoutes() {
  useEventStream();
  return (
    <ShellRenderer>
      <Routes>
        <Route element={<PageSpecOutlet />}>
          <Route index element={<></>} />
          <Route path="*" element={<></>} />
        </Route>
      </Routes>
    </ShellRenderer>
  );
}

function IdentityGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<IdentityStatus>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await resolveIdentity();
      if (cancelled) return;
      setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status.state === "needs_pairing") {
    return (
      <PairingPage
        reason={status.reason}
        onPaired={(session: PairSession) => {
          setStatus({ state: "ready", identity: session });
        }}
      />
    );
  }

  return <>{children}</>;
}

function AppInner() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      {/*
        Chat with no shell. Declared before the `/*` catch-all so it does not
        fall through to ShellRoutes, but still inside IdentityGate — the chat
        transport needs a resolved identity like every other gRPC caller.
      */}
      <Route
        path="/chat-only"
        element={
          <IdentityGate>
            <ChatOnlyPage />
          </IdentityGate>
        }
      />
      <Route
        path="/*"
        element={
          <IdentityGate>
            <ShellRoutes />
          </IdentityGate>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <AppInner />
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
