/**
 * Protocol-driven generate contract for the LLM.
 *
 * Native json-render specs use `elements` as a record/map. `catalog.jsonSchema({
 * strict: true })` cannot represent that (additionalProperties must be false),
 * so structured-output APIs get an empty object. The generate schema uses an
 * *array* of discriminated elements instead — the same idea as Vercel
 * streamObject — then we flatten to a Spec the renderer already understands.
 */
import { z } from "zod";
import type { Spec, UIElement } from "@json-render/core";

const nstr = z.string().nullable();
const tone = z.enum(["default", "ok", "warn", "danger"]).nullable();
const kids = z.array(z.string());

const liveString = z.union([
  z.string(),
  z.object({ $state: z.string() }),
  z.object({ $item: z.string() }),
]);

const actionBinding = z.object({
  action: z.enum(["navigate", "toggleState", "selectPlugin", "callMethod"]),
  params: z.record(z.string(), z.unknown()).nullable(),
});

const elementExtras = {
  id: z.string(),
  children: kids,
  slots: z.record(z.string(), z.array(z.string())).nullable(),
  repeat: z
    .object({
      statePath: z.string(),
      key: nstr,
    })
    .nullable(),
  on: z.record(z.string(), actionBinding).nullable(),
};

export const GenerateElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("container"),
    props: z.object({ className: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("grid"),
    props: z.object({ cols: z.number(), gap: z.number().nullable(), className: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("card"),
    props: z.object({ title: nstr, subtitle: nstr, tone, className: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("row"),
    props: z.object({ className: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("splitPane"),
    props: z.object({
      direction: z.enum(["vertical", "horizontal"]).nullable(),
      className: nstr,
    }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("pageHeader"),
    props: z.object({ title: z.string(), subtitle: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("heading"),
    props: z.object({ text: z.string(), level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable() }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("text"),
    props: z.object({ text: liveString, className: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("kv"),
    props: z.object({ label: z.string(), value: z.unknown(), kind: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("statCard"),
    props: z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      sub: nstr,
      tone,
    }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("badge"),
    props: z.object({
      text: nstr,
      label: nstr,
      tone: z.enum(["default", "ok", "warn", "danger", "info"]).nullable(),
    }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("pill"),
    props: z.object({ text: z.string(), tone }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("callout"),
    props: z.object({ tone }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("statusBanner"),
    props: z.object({ title: nstr, message: nstr, tone }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("emptyState"),
    props: z.object({ title: z.string(), hint: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("healthPill"),
    props: z.object({ label: z.string(), okText: z.string(), offlineText: z.string() }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("pluginState"),
    props: z.object({ pluginId: z.string() }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("stateValue"),
    props: z.object({
      path: z.string(),
      label: nstr,
      format: z.enum(["raw", "json", "bytes", "duration"]).nullable(),
    }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("streamObject"),
    props: z.object({ pluginId: z.string(), member: nstr, className: nstr }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("antigravityChatContainer"),
    props: z.object({
      streamId: z.string(),
      title: nstr,
      mode: z.enum(["live", "accountability"]).nullable(),
      placeholder: nstr,
    }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("chatMessage"),
    props: z.object({
      role: z.union([
        z.enum(["user", "agent", "system"]),
        z.object({ $item: z.string() }),
      ]),
      content: liveString,
    }),
    ...elementExtras,
  }),
  z.object({
    type: z.literal("tchedRouterPicker"),
    props: z.object({ className: nstr }),
    ...elementExtras,
  }),
]);

export const GenerateUiSchema = z.object({
  root: z.string(),
  elements: z.array(GenerateElementSchema),
});

export type GenerateUi = z.infer<typeof GenerateUiSchema>;

/** Strict JSON Schema for structured output (streamObject-equivalent). */
export function generateResponseSchema(): object {
  return z.toJSONSchema(GenerateUiSchema);
}

export function toFlatSpec(generated: GenerateUi): Spec {
  const elements: Record<string, UIElement> = {};
  for (const node of generated.elements) {
    const { id, type, props, children, slots, repeat, on } = node;
    const element: UIElement = {
      type,
      props: props as Record<string, unknown>,
      children,
    };
    if (slots) element.slots = slots;
    if (repeat) element.repeat = { statePath: repeat.statePath, key: repeat.key ?? undefined };
    if (on) element.on = on as UIElement["on"];
    elements[id] = element;
  }
  return { root: generated.root, elements };
}

export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("model output contained no JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function parseGeneratedSpec(text: string): { spec: Spec; generated: GenerateUi } {
  const parsed = extractJsonObject(text);
  const generated = GenerateUiSchema.parse(parsed);
  return { spec: toFlatSpec(generated), generated };
}
