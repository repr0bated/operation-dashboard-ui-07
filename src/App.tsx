// Dashboard SPA. Identity gate, then the json-render shell.
// Live Chat / Catalog / Gallery / Stream pages are page specs, not generated gRPC pages.
import { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
      {/* Every authenticated route is one persistent chat + Canvas surface.
          Legacy route names select their Canvas destination; they no longer
          mount the old static JSX pages or the retired sidebar shell. */}
      <Route
        path="/*"
        element={
          <IdentityGate>
            <ChatOnlyPage />
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
