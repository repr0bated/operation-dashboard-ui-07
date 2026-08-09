/**
 * Slot registry.
 *
 * The shell is described entirely as a spec, but the *page* inside it is still
 * produced by the router (a page spec when one is registered, otherwise a
 * legacy React route). `contentRegion` in the shell spec names a slot, and the
 * host fills that slot with React children.
 */
import { createContext, useContext, type ReactNode } from "react";

export const CONTENT_SLOT = "content";

const SlotContext = createContext<Record<string, ReactNode>>({});

export function SlotProvider({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children: ReactNode;
}) {
  return <SlotContext.Provider value={slots}>{children}</SlotContext.Provider>;
}

/** Read a named slot; undefined when the host did not provide one. */
export function useSlot(name: string): ReactNode {
  return useContext(SlotContext)[name];
}
