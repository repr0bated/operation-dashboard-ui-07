import { useStateValue } from "@json-render/react";
import type { El } from "./types";

export const PluginState: El<"pluginState"> = ({ props, children }) => {
  const state = useStateValue(`/plugins/${props.pluginId}`);
  if (!state) {
    return (
      <div className="text-xs text-neutral-500 italic">
        waiting for {props.pluginId}...
      </div>
    );
  }
  return <>{children}</>;
};

export const StateValue: El<"stateValue"> = ({ props }) => {
  const { path, label, format } = props;
  const pointer = `/plugins/${path.split(".").join("/")}`;
  const value = useStateValue(pointer);

  const display =
    value === null || value === undefined
      ? "\u2014"
      : format === "json"
        ? JSON.stringify(value, null, 2)
        : format === "bytes" && typeof value === "number"
          ? formatBytes(value)
          : format === "duration" && typeof value === "number"
            ? formatDuration(value)
            : String(value);

  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      {label && <span className="text-neutral-400">{label}</span>}
      <span className="text-neutral-100 font-mono text-xs whitespace-pre-wrap">{display}</span>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rest}s`;
  return `${rest}s`;
}
