import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import type { Spec } from "@json-render/core";
import { Renderer } from "@json-render/react";
import { appCatalog } from "../catalog";
import { GALLERY_SKIP, STREAM_GALLERY_NAMES, mockPropsFor } from "../gallery-mocks";
import { tryGetAppRegistry } from "../registry-holder";
import type { El } from "./types";

interface CatalogDecl {
  description?: string;
  slots?: string[];
}

class TileErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: string | null }
> {
  constructor(props: { name: string; children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[gallery] ${this.props.name}`, error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <p className="text-[11px] text-amber-400 font-mono">demo failed: {this.state.error}</p>
      );
    }
    return this.props.children;
  }
}

function catalogDecls(): Record<string, CatalogDecl> {
  return (appCatalog.data as { components: Record<string, CatalogDecl> }).components;
}

function buildDemoSpec(name: string): Spec {
  const props = mockPropsFor(name);
  const decl = catalogDecls()[name];
  const slotted = Array.isArray(decl?.slots) && decl.slots.includes("default");

  if (name === "splitPane") {
    return {
      root: "demo",
      elements: {
        demo: {
          type: "splitPane",
          props,
          slots: { start: ["a"], end: ["b"] },
        },
        a: { type: "text", props: { text: "start pane", className: "text-xs text-neutral-400" } },
        b: { type: "text", props: { text: "end pane", className: "text-xs text-neutral-400" } },
      },
    };
  }

  if (name === "grid") {
    return {
      root: "demo",
      elements: {
        demo: { type: name, props, children: ["a", "b"] },
        a: { type: "text", props: { text: "col A", className: "text-xs text-neutral-400" } },
        b: { type: "text", props: { text: "col B", className: "text-xs text-neutral-400" } },
      },
    };
  }

  if (slotted) {
    return {
      root: "demo",
      elements: {
        demo: { type: name, props, children: ["slot"] },
        slot: {
          type: "text",
          props: { text: "slot child", className: "text-xs text-neutral-400" },
        },
      },
    };
  }

  return {
    root: "demo",
    elements: {
      demo: { type: name, props },
    },
  };
}

function GalleryTile({ name }: { name: string }) {
  const decl = catalogDecls()[name];
  const spec = useMemo(() => buildDemoSpec(name), [name]);
  const registry = tryGetAppRegistry();
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 flex flex-col gap-2 min-h-0">
      <h3 className="text-sm font-mono text-neutral-100">{name}</h3>
      {decl?.description ? (
        <p className="text-[11px] text-neutral-500 leading-snug">{decl.description}</p>
      ) : null}
      <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3 max-h-48 overflow-auto">
        <TileErrorBoundary name={name}>
          {registry ? (
            <Renderer spec={spec} registry={registry} />
          ) : (
            <p className="text-[11px] text-neutral-500">registry not bound</p>
          )}
        </TileErrorBoundary>
      </div>
    </div>
  );
}

export const CatalogGalleryEl: El<"catalogGallery"> = ({ props }) => {
  const uiNames = appCatalog.componentNames.filter((name) => !GALLERY_SKIP.has(name));
  return (
    <div className={`flex flex-col gap-6 ${props.className ?? ""}`}>
      <p className="text-xs text-neutral-500 font-mono">
        {uiNames.length} UI demos · {STREAM_GALLERY_NAMES.length} stream objects listed, not live-mounted
      </p>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {uiNames.map((name) => (
          <GalleryTile key={name} name={name} />
        ))}
      </div>
      <div>
        <h3 className="text-sm font-medium text-neutral-200 mb-2">Stream catalog names</h3>
        <p className="text-[11px] text-neutral-500 mb-3">
          Sealed plugin objects. Live tiles live on Stream, not here — mounting them hid Chat behind
          “waiting for contract”.
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
        >
          {STREAM_GALLERY_NAMES.map((name) => (
            <div
              key={name}
              className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2"
            >
              <div className="text-xs font-mono text-neutral-200">{name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
