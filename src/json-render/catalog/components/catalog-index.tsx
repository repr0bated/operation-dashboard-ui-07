import { STREAM_PLUGIN_IDS, toCatalogName } from "../stream-plugins";
import type { El } from "./types";

export const CatalogIndexEl: El<"catalogIndex"> = ({ props }) => (
  <div
    className={`grid gap-2 ${props.className ?? ""}`}
    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
  >
    {STREAM_PLUGIN_IDS.map((id) => (
      <div
        key={id}
        className="rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2"
      >
        <div className="text-sm font-mono text-neutral-100">{toCatalogName(id)}</div>
        <div className="text-[11px] font-mono text-neutral-500 mt-0.5">{id}</div>
      </div>
    ))}
  </div>
);
