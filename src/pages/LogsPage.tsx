/**
 * Logs page — hosts the working EventChain live log (LiveLogPanel).
 *
 * Previously this page polled REST `api.logs.list` into the event store (a
 * static snapshot of gateway file logs). That path never subscribed to
 * EventChain, so it felt "broken" next to Chat's Live Log tab, which used
 * LiveLogPanel → EventChainService.SubscribeEvents. The working panel now
 * lives here; Chat stays chat-only.
 */
import { PageHeader } from "@/components/shell/Primitives";
import { LiveLogPanel } from "@/components/chat/LiveLogPanel";

export default function LogsPage() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-0 pb-3">
        <PageHeader
          title="Logs"
          subtitle="Live EventChain stream (Antigravity steps) via EventChainService.SubscribeEvents."
        />
      </div>
      <div className="flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-card">
        <LiveLogPanel />
      </div>
    </div>
  );
}
