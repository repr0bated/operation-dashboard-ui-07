/**
 * Shell-primitive components exposed to json-render specs.
 *
 * These are the *trusted* platform pieces that a plugin JSON spec is not
 * allowed to reinvent — headers, sidebars, content regions, etc. All of them
 * are thin wrappers around existing React components; visuals are unchanged.
 */
import type { ReactNode } from "react";
import type { ComponentRegistry } from "@json-render/react";
import type { UIElement } from "@json-render/core";
import { PageHeader as PrimitivePageHeader } from "@/components/shell/Primitives";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import { useSlot } from "@/json-render/runtime/JsonRenderProvider";

const AppShellSlot = ({ children }: { children?: ReactNode }) => (
  <div className="contents">{children}</div>
);

const ContentRegion = ({
  element,
  children,
}: {
  element: UIElement<string, { slot?: string }>;
  children?: ReactNode;
}) => {
  const slotName = element.props.slot ?? "content";
  const slotContent = useSlot(slotName);
  return (
    <div data-slot={slotName} className="min-h-0">
      {slotContent ?? children}
    </div>
  );
};

const PageHeaderEl = ({
  element,
}: {
  element: UIElement<string, { title: string; subtitle?: string }>;
}) => (
  <PrimitivePageHeader
    title={element.props.title}
    subtitle={element.props.subtitle}
  />
);

const StatusBanner = ({
  element,
}: {
  element: UIElement<string, { message?: string; title?: string; tone?: "danger" | "warn" | "ok" }>;
}) => {
  const { message, title, tone = "danger" } = element.props;
  if (!message) return null;
  if (tone === "danger") return <ErrorBanner title={title} message={message} />;
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      {title && <div className="font-semibold text-foreground">{title}</div>}
      <div>{message}</div>
    </div>
  );
};

const EmptyStateEl = ({
  element,
}: {
  element: UIElement<string, { title: string; hint?: string }>;
}) => <EmptyState title={element.props.title} hint={element.props.hint} />;

export const shellCatalog: ComponentRegistry = {
  appShell: AppShellSlot as never,
  contentRegion: ContentRegion as never,
  pageHeader: PageHeaderEl as never,
  statusBanner: StatusBanner as never,
  emptyState: EmptyStateEl as never,
};
