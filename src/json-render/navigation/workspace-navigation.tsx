import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { NavGroup, NavItem, NavSection } from "./manifest";

interface WorkspaceNavigationProps {
  groups: NavGroup[];
  selectedRoute: string | null;
  onSelect: (item: NavItem) => void;
}

export function WorkspaceNavigation({
  groups,
  selectedRoute,
  onSelect,
}: WorkspaceNavigationProps) {
  const [openSection, setOpenSection] = useState<NavSection | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef(new Map<NavSection, HTMLButtonElement>());
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenSection(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !openSection) return;
      event.preventDefault();
      setOpenSection(null);
      triggerRefs.current.get(openSection)?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openSection]);

  const focusItem = (items: NavItem[], index: number) => {
    const enabled = items.filter((entry) => !entry.placeholder);
    if (enabled.length === 0) return;
    const wrapped = (index + enabled.length) % enabled.length;
    itemRefs.current.get(enabled[wrapped].id)?.focus();
  };

  const openAndFocus = (group: NavGroup, last = false) => {
    setOpenSection(group.section);
    requestAnimationFrame(() => focusItem(group.items, last ? -1 : 0));
  };

  const onItemKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    group: NavGroup,
    item: NavItem,
  ) => {
    const enabled = group.items.filter((entry) => !entry.placeholder);
    const index = enabled.findIndex((entry) => entry.id === item.id);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(group.items, index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(group.items, index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(group.items, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(group.items, -1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpenSection(null);
      triggerRefs.current.get(group.section)?.focus();
    }
  };

  return (
    <nav
      ref={navRef}
      className="flex flex-wrap items-center gap-1.5 shrink-0"
      aria-label="System views"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpenSection(null);
        }
      }}
    >
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        System
      </span>
      {groups.map((group) => {
        const activeItem = group.items.find((entry) =>
          selectedRoute === entry.route || entry.aliases?.includes(selectedRoute ?? ""),
        );
        const open = openSection === group.section;
        return (
          <div
            key={group.section}
            className="relative"
            onMouseEnter={() => setOpenSection(group.section)}
            onMouseLeave={() => setOpenSection((current) => current === group.section ? null : current)}
          >
            <button
              ref={(node) => {
                if (node) triggerRefs.current.set(group.section, node);
                else triggerRefs.current.delete(group.section);
              }}
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={`workspace-menu-${group.section.replace(/\s+/g, "-").toLowerCase()}`}
              // Pointer hover may already have opened this group before the
              // click fires. Activation is therefore idempotent: click/Enter
              // always leaves the requested menu open; Escape, blur, and an
              // outside click are the explicit dismissal paths.
              onClick={() => setOpenSection(group.section)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  openAndFocus(group);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  openAndFocus(group, true);
                }
              }}
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-sky-600 ${
                activeItem
                  ? "border-sky-700/70 bg-sky-950/50 text-sky-200"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600 hover:text-white"
              }`}
              title={activeItem ? `${group.section} · ${activeItem.label}` : group.section}
            >
              {group.section}
              {activeItem ? <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-label={`${activeItem.label} selected`} /> : null}
              <ChevronDown className={`h-3 w-3 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
              <div
                id={`workspace-menu-${group.section.replace(/\s+/g, "-").toLowerCase()}`}
                role="menu"
                aria-label={group.section}
                className="absolute left-0 top-full z-50 min-w-52 pt-1"
              >
                <div className="rounded-md border border-neutral-700 bg-neutral-950 p-1 shadow-2xl shadow-black/60">
                  {group.items.map((entry) => {
                    const selected = selectedRoute === entry.route || entry.aliases?.includes(selectedRoute ?? "");
                    return (
                      <button
                        key={entry.id}
                        ref={(node) => {
                          if (node) itemRefs.current.set(entry.id, node);
                          else itemRefs.current.delete(entry.id);
                        }}
                        type="button"
                        role="menuitem"
                        aria-current={selected ? "page" : undefined}
                        disabled={entry.placeholder}
                        onClick={() => {
                          onSelect(entry);
                          setOpenSection(null);
                        }}
                        onKeyDown={(event) => onItemKeyDown(event, group, entry)}
                        className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-sky-700 disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected
                            ? "bg-sky-950/70 text-sky-200"
                            : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                        }`}
                      >
                        <span>{entry.label}</span>
                        {entry.placeholder ? (
                          <span className="text-[9px] uppercase tracking-wider text-neutral-600">Soon</span>
                        ) : selected ? (
                          <span className="text-[9px] uppercase tracking-wider text-sky-500">Current</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
