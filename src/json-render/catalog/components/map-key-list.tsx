import { Plus, Trash2 } from "lucide-react";
import { SchemaRenderer } from "@/components/json/SchemaRenderer";
import type { JsonSchema } from "@/types/api";

export interface MapKeyListProps {
  title: string;
  addLabel: string;
  naturalKey: string;
  items: Record<string, unknown>[];
  itemSchema: JsonSchema;
  onChange: (items: Record<string, unknown>[]) => void;
}

export function MapKeyList({
  title,
  addLabel,
  naturalKey,
  items,
  itemSchema,
  onChange,
}: MapKeyListProps) {
  const add = () => {
    const key = window.prompt(`Name for this ${addLabel}`)?.trim();
    if (!key) return;
    if (items.some((item) => String(item[naturalKey] ?? "") === key)) {
      window.alert(`A ${title.toLowerCase()} named "${key}" already exists.`);
      return;
    }
    onChange([...items, { ...defaultItem(itemSchema), [naturalKey]: key }]);
  };

  const rename = (index: number) => {
    const current = String(items[index]?.[naturalKey] ?? "");
    const next = window.prompt(`Rename ${title.toLowerCase()}`, current)?.trim();
    if (!next || next === current) return;
    if (items.some((item, i) => i !== index && String(item[naturalKey] ?? "") === next)) {
      window.alert(`A ${title.toLowerCase()} named "${next}" already exists.`);
      return;
    }
    onChange(items.map((item, i) => (i === index ? { ...item, [naturalKey]: next } : item)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
        >
          <Plus className="h-3 w-3" />
          Add {addLabel}
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-[11px] italic text-muted-foreground">No {title.toLowerCase()} yet.</p>
      )}
      {items.map((item, index) => {
        const key = String(item[naturalKey] ?? `item-${index}`);
        const editorSchema = omitProperty(itemSchema, naturalKey);
        return (
          <div key={`${key}-${index}`} className="rounded-lg border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => rename(index)}
                className="font-mono text-xs text-primary hover:underline"
                title="Rename"
              >
                {key}
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-danger"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
            <SchemaRenderer
              schema={editorSchema}
              data={item}
              onChange={(next) => {
                const record = next && typeof next === "object" && !Array.isArray(next)
                  ? (next as Record<string, unknown>)
                  : item;
                onChange(
                  items.map((entry, i) =>
                    i === index ? { ...record, [naturalKey]: key } : entry,
                  ),
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function omitProperty(schema: JsonSchema, key: string): JsonSchema {
  if (!schema.properties) return schema;
  const { [key]: _removed, ...properties } = schema.properties;
  return { ...schema, properties };
}

function defaultItem(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema.properties ?? {})) {
    if (field.default !== undefined) out[key] = field.default;
  }
  return out;
}
