import { describe, expect, it } from "vitest";
import { registry as jsonRenderRegistry } from "@/json-render/catalog/registry";
import {
  catalogTypeForRole,
  LIVE_PROJECTION_ROLES,
  projectionToSpec,
  ROLE_TO_CATALOG,
  type UiSubidProjection,
} from "@/json-render/projection";

const rows: UiSubidProjection[] = [
  {
    plugin_id: "antigravity",
    kind: "schema",
    id: "antigravity",
    subid: "sch.software.plugin.antigravity.schema@v1",
    category: "sch",
    role: "validation-carrier",
    element_key: "software.plugin.antigravity.schema@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "project",
    subid: "exp.service.antigravity.project@v1",
    category: "exp",
    role: "surface",
    element_key: "service.antigravity.project@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "auth",
    subid: "mut.service.antigravity.auth@v1",
    category: "mut",
    role: "record-editor",
    element_key: "service.antigravity.auth@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "llm_plugin",
    subid: "mut.software.antigravity.llm-plugin@v1",
    category: "mut",
    role: "text-control",
    element_key: "software.antigravity.llm-plugin@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "model_routes",
    subid: "mut.service.antigravity-llm-projection.model-routes@v1",
    category: "mut",
    role: "editable-collection",
    element_key: "service.antigravity-llm-projection.model-routes@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "usage",
    subid: "obs.service.antigravity.usage@v1",
    category: "obs",
    role: "record-view",
    element_key: "service.antigravity.usage@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "config_schema",
    subid: "sch.software.antigravity-llm-projection.config-schema@v1",
    category: "sch",
    role: "validation-carrier",
    element_key: "software.antigravity-llm-projection.config-schema@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "field",
    id: "status",
    subid: "obs.software.antigravity.status@v1",
    category: "obs",
    role: "display-value",
    element_key: "software.antigravity.status@v1",
  },
  {
    plugin_id: "antigravity",
    kind: "method",
    id: "sync",
    subid: "mut.software.antigravity.sync@v1",
    category: "mut",
    role: "structured-control",
    element_key: "software.antigravity.sync@v1",
  },
];

describe("catalogTypeForRole", () => {
  it("maps every live ui_projection role to a catalog name", () => {
    for (const role of LIVE_PROJECTION_ROLES) {
      expect(ROLE_TO_CATALOG[role]).toBeTruthy();
      expect(jsonRenderRegistry).toHaveProperty(catalogTypeForRole(role));
    }
  });

  it("falls back to displayValue for an unknown role so the page cannot go blank", () => {
    expect(catalogTypeForRole("not-a-role")).toBe("displayValue");
  });
});

describe("projectionToSpec", () => {
  it("emits only catalogued component types", () => {
    const spec = projectionToSpec("antigravity", rows, "884fdee36dd85f2a");
    const catalog = new Set(Object.keys(jsonRenderRegistry));
    for (const [key, el] of Object.entries(spec.elements as Record<string, { type: string }>)) {
      expect(catalog.has(el.type), `${key} uses uncatalogued type ${el.type}`).toBe(true);
    }
  });

  it("puts a props object on every element", () => {
    const spec = projectionToSpec("antigravity", rows, "884fdee36dd85f2a");
    for (const [key, el] of Object.entries(
      spec.elements as Record<string, { props?: unknown }>,
    )) {
      expect(el.props, `${key} missing props`).toEqual(expect.any(Object));
    }
  });

  it("never references a missing child", () => {
    const spec = projectionToSpec("antigravity", rows, "884fdee36dd85f2a");
    const elements = spec.elements as Record<string, { children?: string[] }>;
    expect(elements[spec.root]).toBeDefined();
    for (const [key, el] of Object.entries(elements)) {
      for (const child of el.children ?? []) {
        expect(elements[child], `${key} -> missing child ${child}`).toBeDefined();
      }
    }
  });

  it("binds each live role to its catalog type", () => {
    const spec = projectionToSpec("antigravity", rows, "884fdee36dd85f2a");
    const elements = spec.elements as Record<string, { type: string; props?: Record<string, unknown> }>;
    expect(elements["field-project"].type).toBe("surface");
    expect(elements["field-auth"].type).toBe("recordEditor");
    expect(elements["field-llm_plugin"].type).toBe("textControl");
    expect(elements["field-model_routes"].type).toBe("editableCollection");
    expect(elements["field-usage"].type).toBe("recordView");
    expect(elements["field-config_schema"].type).toBe("validationCarrier");
    expect(elements["field-status"].type).toBe("displayValue");
    expect(elements["method-sync"].type).toBe("structuredControl");
    expect(elements["schema-antigravity"].type).toBe("validationCarrier");
  });

  it("wires method press to callMethod by subid", () => {
    const spec = projectionToSpec("antigravity", rows, "884fdee36dd85f2a");
    const method = spec.elements["method-sync"] as {
      on?: { press?: { action: string; params: { subid: string } } };
    };
    expect(method.on?.press?.action).toBe("callMethod");
    expect(method.on?.press?.params.subid).toBe("mut.software.antigravity.sync@v1");
  });
});
