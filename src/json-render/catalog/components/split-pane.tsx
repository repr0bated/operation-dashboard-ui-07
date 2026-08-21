import type { El } from "./types";

export const SplitPane: El<"splitPane"> = ({ props, slots, children }) => {
  const vertical = (props.direction ?? "vertical") === "vertical";
  if (children) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
      >
        <strong>splitPane contract error.</strong> Named <code>start</code> and <code>end</code> slots are
        required; ordinary children were not rendered. Use a grid or container in generated specs.
      </div>
    );
  }
  return (
    <div
      className={`${vertical ? "flex flex-col" : "flex flex-row"} flex-1 min-h-0 ${props.className ?? ""}`}
    >
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">{slots?.start}</div>
      <div
        className={`flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col ${
          vertical ? "border-t border-border pt-3 mt-0" : "border-l border-border pl-3 ml-0"
        }`}
      >
        {slots?.end}
      </div>
    </div>
  );
};

export const Separator: El<"separator"> = ({ props }) => (
  <hr className={`border-border ${props.className ?? ""}`} />
);
