/**
 * Shell component implementations.
 *
 * Each function is the render half of one catalog entry. Together they are a
 * 1:1 port of the old hand-written `AppShell.tsx` chrome — same markup, same
 * Tailwind classes, same behaviour — but the *composition* now lives in
 * `shellSpec.ts` as JSON rather than in JSX.
 */
import { Construction } from "lucide-react";
import { useStateValue } from "@json-render/react";
import { cn } from "@/lib/utils";
import { StatusDot, Pill, PageHeader } from "@/components/shell/Primitives";
import { ErrorBanner, EmptyState } from "@/components/shell/Feedback";
import { useTheme } from "@/hooks/use-theme";
import { resolveIcon } from "@/json-render/navigation/icons";
import { useSlot, CONTENT_SLOT } from "@/json-render/runtime/slots";
import type { El } from "./types";

const themeIcons = { dark: "Moon", light: "Sun", system: "Laptop" } as const;

/** Root grid: topbar row on top, nav + content below. */
export const AppShellEl: El<"appShell"> = ({ props, children }) => (
  <div
    className="h-screen grid overflow-hidden transition-[grid-template-columns] duration-200 ease-out"
    style={{
      gridTemplateColumns: `${
        props.collapsed ? props.collapsedNavWidth : props.navWidth
      } minmax(0,1fr)`,
      gridTemplateRows: `${props.topbarHeight} 1fr`,
      gridTemplateAreas: `"topbar topbar" "nav content"`,
    }}
  >
    {children}
  </div>
);

export const TopbarEl: El<"topbar"> = ({ children }) => (
  <header
    className="flex items-center justify-between gap-4 px-5 h-14 border-b border-border bg-background sticky top-0 z-40"
    style={{ gridArea: "topbar" }}
  >
    {children}
  </header>
);

export const TopbarGroupEl: El<"topbarGroup"> = ({ props, children }) => (
  <div className={cn("flex items-center", props.align === "end" ? "gap-2" : "gap-3")}>
    {children}
  </div>
);

export const NavToggleEl: El<"navToggle"> = ({ props, emit }) => {
  const Icon = resolveIcon("Menu");
  return (
    <button
      onClick={() => emit("press")}
      className="w-9 h-9 flex items-center justify-center rounded-md border border-transparent hover:border-border hover:bg-muted/30 transition-colors"
      title={props.collapsed ? props.expandTitle : props.collapseTitle}
      aria-expanded={!props.collapsed}
    >
      <Icon className="h-[18px] w-[18px] text-muted-foreground" />
    </button>
  );
};

export const BrandEl: El<"brand"> = ({ props }) => {
  const Icon = resolveIcon(props.icon ?? "Shield");
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
      <div className="flex flex-col">
        <span className="text-base font-bold tracking-tight leading-none text-foreground">
          {props.title}
        </span>
        {props.subtitle && (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
            {props.subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

export const HealthPillEl: El<"healthPill"> = ({ props }) => {
  const connected = Boolean(useStateValue("/connected"));
  return (
    <Pill variant={connected ? "ok" : "danger"}>
      <StatusDot status={connected ? "ok" : "error"} />
      <span>{props.label}</span>
      <span className="font-mono">{connected ? props.okText : props.offlineText}</span>
    </Pill>
  );
};

export const ThemeToggleEl: El<"themeToggle"> = ({ props }) => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="relative flex rounded-full border border-border bg-secondary p-0.5">
      {props.modes.map((mode) => {
        const Icon = resolveIcon(themeIcons[mode]);
        const active = theme === mode;
        return (
          <button
            key={mode}
            onClick={() => setTheme(mode)}
            className={cn(
              "h-6 w-6 grid place-items-center rounded-full transition-colors relative z-10",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={mode}
            aria-pressed={active}
          >
            <Icon className="h-3 w-3" />
            {active && (
              <span className="absolute inset-0 rounded-full bg-primary -z-10 transition-transform" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export const SidebarEl: El<"sidebar"> = ({ props, children }) => (
  <aside
    className={cn(
      "overflow-y-auto overflow-x-hidden py-4 px-3 bg-background transition-all duration-200 ease-out min-h-0",
      props.collapsed && "w-0 min-w-0 p-0 overflow-hidden opacity-0 pointer-events-none",
    )}
    style={{ gridArea: "nav", scrollbarWidth: "none" }}
  >
    {children}
  </aside>
);

export const NavSectionEl: El<"navSection"> = ({ props, children, emit }) => {
  // A section holding the active route stays open regardless of its own
  // collapse flag — matches the original shell.
  const hasActive = props.activeSection === props.sectionKey;
  const showOpenIndicator = !props.collapsed || hasActive;
  return (
    <div className="mb-5 last:mb-0">
      <button
        onClick={() => emit("toggle")}
        className="flex items-center justify-between gap-2 w-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground rounded-md hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <span>{props.label}</span>
        <span className="text-[10px] opacity-50">{showOpenIndicator ? "−" : "+"}</span>
      </button>
      {children}
    </div>
  );
};

export const NavItemListEl: El<"navItemList"> = ({ children }) => (
  <div className="mt-1 space-y-px">{children}</div>
);

export const NavItemEl: El<"navItem"> = ({ props, emit }) => {
  const Icon = resolveIcon(props.icon ?? undefined);
  const aliases = props.aliases ?? [];
  const active =
    props.activeRoute === props.route ||
    (typeof props.activeRoute === "string" && aliases.includes(props.activeRoute));
  const isPlaceholder = props.placeholder === true;
  const isWip = props.wip === true;
  return (
    <button
      onClick={() => !isPlaceholder && emit("press")}
      disabled={isPlaceholder}
      title={
        isPlaceholder
          ? (props.placeholderHint ?? "Coming soon")
          : isWip
            ? "Work in progress — not wired to live data"
            : undefined
      }
      aria-current={active ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors border border-transparent",
        active
          ? "bg-primary/10 text-foreground border-primary/20"
          : isPlaceholder
            ? "text-muted-foreground/40 cursor-not-allowed italic"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : isPlaceholder ? "opacity-30" : "opacity-70",
        )}
      />
      <span className="whitespace-nowrap">{props.label}</span>
      {isPlaceholder && (
        <span className="ml-auto text-[9px] uppercase tracking-wider opacity-60">
          Soon
        </span>
      )}
      {!isPlaceholder && isWip && (
        <span className="ml-auto text-[9px] uppercase tracking-wider text-warn/80 border border-warn/30 rounded px-1 py-px">
          WIP
        </span>
      )}
    </button>
  );
};

export const NavResourcesEl: El<"navResources"> = ({ props }) => (
  <div className="mt-6">
    <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
      {props.label}
    </div>
    {props.links.map((link) => {
      const Icon = resolveIcon(link.icon ?? "FileText");
      return (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <Icon className="h-4 w-4 opacity-70" />
          <span>{link.label}</span>
        </a>
      );
    })}
  </div>
);

export const ContentRegionEl: El<"contentRegion"> = ({ props, children }) => {
  const slotContent = useSlot(props.slot ?? CONTENT_SLOT);
  const isFullHeight =
    props.route != null && props.fullHeightRoutes.includes(props.route);
  const wip = props.wipRoutes.find((w) => w.route === props.route);
  return (
    <main
      className={cn(
        "min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4 space-y-6",
        isFullHeight && "flex flex-col overflow-hidden p-0 space-y-0",
      )}
      style={{ gridArea: "content" }}
    >
      {wip && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-md border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs",
            isFullHeight && "m-3 md:m-4",
          )}
        >
          <Construction className="h-4 w-4 text-warn shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-warn uppercase tracking-wider text-[11px]">
              Work in progress
            </div>
            <div className="text-warn/80">{wip.reason}</div>
          </div>
        </div>
      )}
      {slotContent ?? children}
    </main>
  );
};

export const PageHeaderEl: El<"pageHeader"> = ({ props }) => (
  <PageHeader title={props.title} subtitle={props.subtitle ?? undefined} />
);

export const StatusBannerEl: El<"statusBanner"> = ({ props }) => {
  if (!props.message) return null;
  if ((props.tone ?? "danger") === "danger") {
    return <ErrorBanner title={props.title ?? undefined} message={props.message} />;
  }
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      {props.title && <div className="font-semibold text-foreground">{props.title}</div>}
      <div>{props.message}</div>
    </div>
  );
};

export const EmptyStateEl: El<"emptyState"> = ({ props }) => (
  <EmptyState title={props.title} hint={props.hint ?? undefined} />
);
