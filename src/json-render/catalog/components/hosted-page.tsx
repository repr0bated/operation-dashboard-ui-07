import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { El } from "./types";

const pages: Record<string, LazyExoticComponent<ComponentType>> = {
  "/antigravity-llm": lazy(() => import("@/pages/AntiqravityLLMPage")),
  "/orchestration": lazy(() => import("@/pages/OrchestrationPage")),
  "/services": lazy(() => import("@/pages/ServicesPage")),
  "/llm": lazy(() => import("@/pages/LlmPage")),
  "/assistant": lazy(() => import("@/pages/AssistantPage")),
  "/models": lazy(() => import("@/pages/RoutableModelsPage")),
  "/tools": lazy(() => import("@/pages/ToolsPage")),
  "/workflows": lazy(() => import("@/pages/WorkflowsPage")),
  "/security": lazy(() => import("@/pages/SecurityPage")),
  "/skills": lazy(() => import("@/pages/SkillsPage")),
  "/knowledge": lazy(() => import("@/pages/KnowledgePage")),
  "/embedding": lazy(() => import("@/pages/EmbeddingPipelinePage")),
  "/containers": lazy(() => import("@/pages/ContainersPage")),
  "/privacy-network": lazy(() => import("@/pages/PrivacyNetworkPage")),
  "/netmaker": lazy(() => import("@/pages/NetmakerPage")),
  "/ovs": lazy(() => import("@/pages/OpenSwitchPage")),
  "/openflow": lazy(() => import("@/pages/OpenFlowPage")),
  "/btrfs": lazy(() => import("@/pages/BtrfsPage")),
  "/data-stores": lazy(() => import("@/pages/DataStoresPage")),
  "/gateway": lazy(() => import("@/pages/GatewayPage")),
  "/channels": lazy(() => import("@/pages/ChannelsPage")),
  "/cron": lazy(() => import("@/pages/CronPage")),
  "/integrations": lazy(() => import("@/pages/IntegrationsPage")),
  "/hardware": lazy(() => import("@/pages/HardwarePage")),
  "/config": lazy(() => import("@/pages/ConfigPage")),
  "/inspector": lazy(() => import("@/pages/InspectorPage")),
  "/state": lazy(() => import("@/pages/StatePage")),
  "/logs": lazy(() => import("@/pages/LogsPage")),
  "/estop": lazy(() => import("@/pages/EStopPage")),
  "/grpc": lazy(() => import("@/pages/GrpcDiagnosticsPage")),
  "/explorer": lazy(() => import("@/pages/GrpcExplorerPage")),
  "/invoke": lazy(() => import("@/pages/InvokePage")),
  "/blobs": lazy(() => import("@/pages/BlobsPage")),
};

export const HOSTED_PAGE_ROUTES = Object.keys(pages);

export const HostedPageEl: El<"hostedPage"> = ({ props }) => {
  const Page = pages[props.route];
  if (!Page) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No hosted page for <span className="font-mono">{props.route}</span>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Suspense
        fallback={
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading {props.route}…</div>
        }
      >
        <Page />
      </Suspense>
    </div>
  );
};
