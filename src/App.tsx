// Dashboard SPA. Identity gate: if no Ghostbridge footprint/trace is available
// (config, env, pair session, or live sled), show PairingPage before the shell.
import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEventStream } from "@/hooks/use-event-stream";
import { ShellRenderer, PageSpecOutlet } from "@/json-render";

const ChatPage = lazy(() => import("./pages/ChatPage"));
const ToolsPage = lazy(() => import("./pages/ToolsPage"));
const RoutableModelsPage = lazy(() => import("./pages/RoutableModelsPage"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const LlmPage = lazy(() => import("./pages/LlmPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const InspectorPage = lazy(() => import("./pages/InspectorPage"));
const StatePage = lazy(() => import("./pages/StatePage"));
const LogsPage = lazy(() => import("./pages/LogsPage"));
const WorkflowsPage = lazy(() => import("./pages/WorkflowsPage"));
const OrchestrationPage = lazy(() => import("./pages/OrchestrationPage"));
const SkillsPage = lazy(() => import("./pages/SkillsPage"));
const ContainersPage = lazy(() => import("./pages/ContainersPage"));
const PrivacyNetworkPage = lazy(() => import("./pages/PrivacyNetworkPage"));
const OpenSwitchPage = lazy(() => import("./pages/OpenSwitchPage"));
const OpenFlowPage = lazy(() => import("./pages/OpenFlowPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const GrpcDiagnosticsPage = lazy(() => import("./pages/GrpcDiagnosticsPage"));
const AccountabilityPage = lazy(() => import("./pages/AccountabilityPage"));
const BtrfsPage = lazy(() => import("./pages/BtrfsPage"));
const NetmakerPage = lazy(() => import("./pages/NetmakerPage"));
const DataStoresPage = lazy(() => import("./pages/DataStoresPage"));
const EmbeddingPipelinePage = lazy(() => import("./pages/EmbeddingPipelinePage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const GrpcExplorerPage = lazy(() => import("./pages/GrpcExplorerPage"));
const InvokePage = lazy(() => import("./pages/InvokePage"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const GalleryGenPage = lazy(() => import("./pages/GalleryGenPage"));
const AntiqravityLLMPage = lazy(() => import("./pages/AntiqravityLLMPage"));
const CatalogUIGeneratorPage = lazy(() => import("./pages/CatalogUIGeneratorPage"));
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const BlobsPage = lazy(() => import("./pages/BlobsPage"));
const PluginsPage = lazy(() => import("./pages/PluginsPage"));
const PluginPage = lazy(() => import("./components/PluginPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
import RegisterPage from "./pages/RegisterPage";
import PairingPage from "./pages/PairingPage";
const GatewayPage = lazy(() => import("./pages/GatewayPage"));
const ChannelsPage = lazy(() => import("./pages/ChannelsPage"));
const CronPage = lazy(() => import("./pages/CronPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const EStopPage = lazy(() => import("./pages/EStopPage"));
const HardwarePage = lazy(() => import("./pages/HardwarePage"));
import {
  resolveIdentity,
  type IdentityStatus,
  type PairSession,
} from "@/lib/identity";
import { resetTransport } from "@/grpc/client";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000, refetchOnWindowFocus: false },
  },
});

// Dashboard routes live inside the spec-driven shell; the event stream only
// runs here so public pages don't open the admin SSE channel.
//
// PageSpecOutlet is a layout route: if PAGE_SPECS has the pathname it renders
// the json-render spec; otherwise <Outlet /> falls through to the React page.
function ShellRoutes() {
  useEventStream();
  return (
    <ShellRenderer>
      <Routes>
        <Route element={<PageSpecOutlet />}>
          {/* Index keeps `/` matched so PAGE_SPECS["/"] (Overview) can render. */}
          <Route index element={<></>} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery-gen" element={<GalleryGenPage />} />
          <Route path="/antigravity-llm" element={<AntiqravityLLMPage />} />
          <Route path="/catalog-generator" element={<CatalogUIGeneratorPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/models" element={<RoutableModelsPage />} />
          <Route path="/llm" element={<LlmPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/inspector" element={<InspectorPage />} />
          <Route path="/state" element={<StatePage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/orchestration" element={<OrchestrationPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/privacy-network" element={<PrivacyNetworkPage />} />
          <Route path="/ovs" element={<OpenSwitchPage />} />
          <Route path="/openflow" element={<OpenFlowPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/grpc" element={<GrpcDiagnosticsPage />} />
          <Route path="/explorer" element={<GrpcExplorerPage />} />
          <Route path="/invoke" element={<InvokePage />} />
          <Route path="/accountability" element={<AccountabilityPage />} />
          <Route path="/btrfs" element={<BtrfsPage />} />
          <Route path="/netmaker" element={<NetmakerPage />} />
          <Route path="/data-stores" element={<DataStoresPage />} />
          <Route path="/embedding" element={<EmbeddingPipelinePage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/blobs" element={<BlobsPage />} />
          <Route path="/plugins" element={<PluginsPage />} />
          <Route path="/plugin/:pluginId" element={<PluginPage />} />
          <Route path="/gateway" element={<GatewayPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/cron" element={<CronPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/estop" element={<EStopPage />} />
          <Route path="/hardware" element={<HardwarePage />} />
          <Route path="*" element={<NotFound />} />
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
      if (next.state === "ready") {
        resetTransport();
      }
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
          resetTransport();
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
      {/* Public surfaces — no identity gate */}
      <Route path="/register" element={<RegisterPage />} />
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
