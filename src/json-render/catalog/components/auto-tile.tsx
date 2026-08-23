import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { uiStore } from "@/json-render/store/ui-store";
import {
  autoTileSizeClass,
  colSpanForCatalogType,
  colSpanForOverflow,
  AUTO_TILE_COLUMNS,
  AUTO_TILE_GAP_PX,
  type AutoTileSize,
} from "@/json-render/spec-gen/auto-tile";
import type { El } from "./types";

const DragHandleContext = createContext<HTMLAttributes<HTMLButtonElement> | null>(null);

function childKey(child: ReactNode, index: number): string {
  if (isValidElement(child) && child.key != null) {
    return String(child.key).replace(/^\.\$?/, "");
  }
  return String(index);
}

function catalogProps(child: ReactNode): Record<string, unknown> {
  if (!isValidElement(child)) return {};
  const raw = (child.props ?? {}) as { props?: unknown } & Record<string, unknown>;
  if (raw.props && typeof raw.props === "object" && !Array.isArray(raw.props)) {
    return raw.props as Record<string, unknown>;
  }
  return raw;
}

function tileIdOf(child: ReactNode, index: number): string {
  const tileId = catalogProps(child).tileId;
  if (typeof tileId === "string" && tileId.length > 0) return tileId;
  return childKey(child, index);
}

function sizeOf(child: ReactNode): AutoTileSize | null {
  const size = catalogProps(child).size;
  if (size === "small" || size === "medium" || size === "large") return size;
  return null;
}

function contentTypeOf(child: ReactNode): string {
  const type = catalogProps(child).contentType;
  return typeof type === "string" ? type : "";
}

function orderPath(boardId: string): string {
  return `/autotile/${boardId}/order`;
}

function readStoredOrder(boardId: string): string[] | null {
  const stored = uiStore.get(orderPath(boardId));
  return Array.isArray(stored) ? stored.map(String) : null;
}

function applyOrder(ids: string[], order: string[] | null): string[] {
  if (!order?.length) return ids;
  const have = new Set(ids);
  const next = order.filter((id) => have.has(id));
  for (const id of ids) {
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

function startingSpan(child: ReactNode, columns: number, fit: "content" | "hint"): number {
  const size = sizeOf(child);
  if (fit === "hint" && size) {
    if (size === "large") return columns;
    if (size === "medium") return Math.ceil(columns / 2);
    return Math.max(3, Math.floor(columns / 3));
  }
  const type = contentTypeOf(child);
  if (type) return colSpanForCatalogType(type, columns);
  if (size === "large") return columns;
  if (size === "medium") return Math.ceil(columns / 2);
  return Math.max(3, Math.floor(columns / 3));
}

function SortableShell({
  id,
  child,
  columns,
  gap,
  fit,
  disabled,
  children,
}: {
  id: string;
  child: ReactNode;
  columns: number;
  gap: number;
  fit: "content" | "hint";
  disabled: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const boxRef = useRef<HTMLDivElement | null>(null);
  const minSpan = startingSpan(child, columns, fit);
  const [span, setSpan] = useState(minSpan);

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      boxRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  useLayoutEffect(() => {
    if (fit !== "content") return;
    const el = boxRef.current;
    const board = el?.parentElement;
    const body = el?.querySelector("[data-autotile-body]") as HTMLElement | null;
    if (!el || !board || !body) return;

    const measure = () => {
      const usable = board.clientWidth - gap * Math.max(0, columns - 1);
      if (usable <= 0) return;
      const colW = usable / columns;
      setSpan((current) => {
        const next = colSpanForOverflow(
          body.scrollWidth,
          body.clientWidth,
          colW,
          current,
          columns,
        );
        return next === current ? current : Math.max(next, minSpan);
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(board);
    return () => observer.disconnect();
  }, [columns, fit, gap, minSpan]);

  const size = sizeOf(child);
  return (
    <div
      ref={setRefs}
      className={cn(
        fit === "hint" && size ? autoTileSizeClass(size) : null,
        "self-start overflow-hidden rounded-xl border border-border bg-card",
        isDragging && "z-10",
      )}
      style={{
        gridColumn: fit === "hint" && size ? undefined : `span ${span}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <DragHandleContext.Provider value={disabled ? null : { ...attributes, ...listeners }}>
        {children}
      </DragHandleContext.Provider>
    </div>
  );
}

/**
 * CSS grid packs tiles; @dnd-kit reorders them.
 * fit=content: height follows the widget, columns grow to the data.
 */
export const AutoTileEl: El<"autoTile"> = ({ props, children, emit }) => {
  const columns = props.columns ?? AUTO_TILE_COLUMNS;
  const gap = props.gap ?? AUTO_TILE_GAP_PX;
  const reorderable = props.reorderable !== false;
  const fit = props.fit === "hint" ? "hint" : "content";
  const boardId = props.boardId ?? "default";
  const items = Children.toArray(children);
  const ids = items.map((child, index) => tileIdOf(child, index));
  const [order, setOrder] = useState<string[] | null>(() => readStoredOrder(boardId));
  const orderedIds = applyOrder(ids, order);
  const byId = new Map(items.map((child, index) => [tileIdOf(child, index), child]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrder((current) => {
        const list = applyOrder(ids, current);
        const oldIndex = list.indexOf(String(active.id));
        const newIndex = list.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return current;
        const next = arrayMove(list, oldIndex, newIndex);
        uiStore.set(orderPath(boardId), next);
        emit("reorder");
        return next;
      });
    },
    [boardId, emit, ids],
  );

  const board = (
    <div
      className={cn("grid w-full grid-flow-row-dense items-start", props.className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: "min-content",
        gap: `${gap}px`,
      }}
    >
      {orderedIds.map((id) => {
        const child = byId.get(id);
        if (!child) return null;
        return (
          <SortableShell
            key={id}
            id={id}
            child={child}
            columns={columns}
            gap={gap}
            fit={fit}
            disabled={!reorderable}
          >
            {child}
          </SortableShell>
        );
      })}
    </div>
  );

  if (!reorderable) return board;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
        {board}
      </SortableContext>
    </DndContext>
  );
};

export const AutoTileItemEl: El<"autoTileItem"> = ({ props, children }) => {
  const dragHandleProps = useContext(DragHandleContext);
  return (
    <div className={cn("flex h-auto min-h-0 flex-col", props.className)}>
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1">
        {dragHandleProps ? (
          <button
            type="button"
            className="cursor-grab rounded p-0.5 text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to rearrange tile"
            title="Drag to rearrange"
            {...dragHandleProps}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div data-autotile-body className="min-h-0 flex-1 p-3">
        {children}
      </div>
    </div>
  );
};
