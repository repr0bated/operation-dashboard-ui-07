import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Spec } from "@json-render/core";
import { ALLOW_ALL } from "@/json-render/navigation/capabilities";
import {
  NAV_MANIFEST,
  buildNavGroups,
  type NavGroup,
} from "@/json-render/navigation/manifest";
import {
  buildReferencePagePrompt,
  referencePageFor,
} from "@/json-render/navigation/reference-pages";
import { WorkspaceNavigation } from "@/json-render/navigation/workspace-navigation";
import {
  clearReferencePageCache,
  readReferencePageCache,
  writeReferencePageCache,
} from "@/json-render/generate/use-reference-page-spec";

describe("navigation-driven Canvas", () => {
  it("groups every required system destination and keeps future views disabled", () => {
    const groups = buildNavGroups(NAV_MANIFEST, ALLOW_ALL);
    const labels = Object.fromEntries(
      groups.map((group) => [group.section, group.items.map((entry) => entry.label)]),
    );

    expect(labels.Chat).toEqual(["Chat", "Accountability"]);
    expect(labels["UI Model"]).toEqual(["Catalog", "Gallery", "Generate", "Antigravity LLM"]);
    expect(labels.Control).toEqual(["Overview", "Orchestration", "Services", "LLM"]);
    expect(labels.Agent).toContain("Embedding Pipeline");
    expect(labels.Infrastructure).toContain("Network Control");
    expect(labels.ZeroClaw).toEqual(["Gateway", "Channels", "Cron", "Integrations", "Hardware"]);
    expect(labels.Settings).toContain("Invoke");
    expect(labels.Blobs).toEqual(["Sealed Blobs"]);
    expect(labels.Plugins).toEqual(["Stream"]);
    expect(NAV_MANIFEST.find((entry) => entry.route === "/plugins")?.referencePage).toBeUndefined();
    expect(NAV_MANIFEST.find((entry) => entry.route === "/antigravity-llm")?.referencePage)
      .toBe("AntiqravityLLMPage.tsx");
    expect(NAV_MANIFEST.filter((entry) => entry.section === "Coming Soon"))
      .toSatisfy((entries: typeof NAV_MANIFEST) => entries.every((entry) => entry.placeholder));
  });

  it("builds each generated destination from exactly one legacy reference with a mock contract", () => {
    const references = NAV_MANIFEST.filter((entry) => entry.referencePage);
    expect(references.length).toBeGreaterThan(20);
    for (const entry of references) {
      const reference = referencePageFor(entry);
      expect(reference?.sourcePath).toBe(`src/pages/${entry.referencePage}`);
      expect(reference?.source).toContain("export default");
      const prompt = buildReferencePagePrompt(reference!);
      expect(prompt).toContain("REFERENCE MOCK");
      expect(prompt).toContain("existing Canvas");
      expect(prompt).toContain("RFC 6902 SpecStream patches");
      expect(prompt).toContain(reference!.source);
    }

    const tools = referencePageFor(NAV_MANIFEST.find((entry) => entry.id === "tools"));
    const prompt = buildReferencePagePrompt(tools!);
    expect(prompt).toContain("Simulated result");
    expect(prompt).not.toContain("Gateway management coming soon");
  });

  it("caches a successful generated spec for the browser session", () => {
    const route = "/test-reference-cache";
    const spec: Spec = {
      root: "root",
      elements: { root: { type: "container", props: {}, children: [] } },
    };
    clearReferencePageCache(route);
    expect(readReferencePageCache(route)).toBeNull();
    writeReferencePageCache(route, spec);
    expect(readReferencePageCache(route)).toEqual(spec);
    clearReferencePageCache(route);
    expect(readReferencePageCache(route)).toBeNull();
  });

  it("opens categorized menus by keyboard, marks selection, and dispatches a choice", () => {
    const onSelect = vi.fn();
    const groups: NavGroup[] = [
      {
        section: "Control",
        items: [
          { id: "overview", label: "Overview", route: "/overview", icon: "BarChart3", section: "Control", order: 1 },
          { id: "services", label: "Services", route: "/services", icon: "Link2", section: "Control", order: 2 },
        ],
      },
    ];
    render(<WorkspaceNavigation groups={groups} selectedRoute="/overview" onSelect={onSelect} />);

    const trigger = screen.getByRole("button", { name: /Control/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /Overview/ })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("menuitem", { name: /Services/ }));
    expect(onSelect).toHaveBeenCalledWith(groups[0].items[1]);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a trigger menu open when focus precedes the pointer click", () => {
    const groups: NavGroup[] = [
      {
        section: "Control",
        items: [
          { id: "overview", label: "Overview", route: "/overview", icon: "BarChart3", section: "Control", order: 1 },
        ],
      },
    ];
    render(<WorkspaceNavigation groups={groups} selectedRoute="/overview" onSelect={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /Control/ });
    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /Overview/ })).toBeVisible();
  });
});
