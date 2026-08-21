import type { Spec } from "@json-render/core";
import { catalogTypeForRole } from "./roles";

/** Wire row from GET /api/ui-model/plugin-schema/:id → ui_projection. */
export interface UiSubidProjection {
  plugin_id: string;
  kind: string;
  id: string;
  subid: string;
  category: string;
  role: string;
  element_key: string;
}

const KIND = new Set(["field", "method", "schema"]);

function specKey(row: UiSubidProjection): string {
  return `${row.kind}-${row.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function add(
  elements: Record<string, unknown>,
  key: string,
  element: Record<string, unknown>,
): string {
  const props =
    element.props && typeof element.props === "object" ? element.props : {};
  elements[key] = { bindings: {}, ...element, props };
  return key;
}

function projectionProps(pluginId: string, row: UiSubidProjection) {
  const kind = KIND.has(row.kind) ? row.kind : "field";
  return {
    pluginId,
    kind,
    field: row.id,
    label: row.id,
    subid: row.subid,
    role: row.role,
  };
}

/**
 * Fold a plugin's ui_projection into a spec that only names catalog types.
 * Live values are bound by the role components to /plugins/<id>/<field>.
 */
export function projectionToSpec(
  pluginId: string,
  rows: UiSubidProjection[],
  schemaHash?: string,
): Spec {
  const elements: Record<string, unknown> = {};
  const fields: UiSubidProjection[] = [];
  const methods: UiSubidProjection[] = [];
  const schemaRows: UiSubidProjection[] = [];

  for (const row of rows) {
    if (row.kind === "method") methods.push(row);
    else if (row.kind === "schema") schemaRows.push(row);
    else fields.push(row);
  }

  const hashLabel = schemaHash ? schemaHash.slice(0, 16) : "waiting for contract";
  const headerChildren: string[] = [];
  for (const row of schemaRows) {
    headerChildren.push(
      add(elements, specKey(row), {
        type: catalogTypeForRole(row.role),
        props: projectionProps(pluginId, row),
      }),
    );
  }

  add(elements, "header", {
    type: "pageHeader",
    props: {
      title: pluginId,
      subtitle: `sealed ${hashLabel} · ${fields.length} fields · ${methods.length} methods`,
    },
  });

  const fieldKeys = fields.map((row) =>
    add(elements, specKey(row), {
      type: catalogTypeForRole(row.role),
      props: projectionProps(pluginId, row),
    }),
  );

  add(elements, "fields-grid", {
    type: "grid",
    props: { cols: 2, gap: 3, className: "grid-cols-1 lg:grid-cols-2" },
    children: fieldKeys,
  });

  const methodKeys = methods.map((row) =>
    add(elements, specKey(row), {
      type: catalogTypeForRole(row.role),
      props: projectionProps(pluginId, row),
      on: {
        press: {
          action: "callMethod",
          params: { subid: row.subid, input: {} },
        },
      },
    }),
  );

  if (methodKeys.length > 0) {
    add(elements, "methods", {
      type: "card",
      props: {
        title: `Methods (${methodKeys.length})`,
        subtitle: "Press a row to invoke by subid",
        tone: "default",
        className: null,
      },
      children: methodKeys,
    });
  }

  const rootChildren = ["header", ...headerChildren, "fields-grid"];
  if (methodKeys.length > 0) rootChildren.push("methods");

  add(elements, "root", {
    type: "container",
    props: { className: "flex flex-col gap-4" },
    children: rootChildren,
  });

  return { root: "root", elements } as Spec;
}

export function loadingSpec(pluginId: string): Spec {
  return {
    root: "root",
    elements: {
      root: {
        type: "emptyState",
        props: { title: `Loading ${pluginId}`, hint: "Reading sealed schema + ui_projection" },
      },
    },
  };
}

export function errorSpec(pluginId: string, message: string): Spec {
  return {
    root: "root",
    elements: {
      root: {
        type: "statusBanner",
        props: { title: pluginId, message, tone: "danger" },
      },
    },
  };
}
