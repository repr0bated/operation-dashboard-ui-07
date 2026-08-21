import type { El } from "./types";

export const SplitPane: El<"splitPane"> = ({ props, slots }) => {
  const vertical = (props.direction ?? "vertical") === "vertical";
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
