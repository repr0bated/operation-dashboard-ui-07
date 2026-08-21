import type { ComponentRegistry } from "@json-render/react";

let appRegistry: ComponentRegistry | null = null;

export function setAppRegistry(registry: ComponentRegistry): void {
  appRegistry = registry;
}

export function getAppRegistry(): ComponentRegistry {
  if (!appRegistry) {
    throw new Error("json-render registry is not bound yet");
  }
  return appRegistry;
}

export function tryGetAppRegistry(): ComponentRegistry | null {
  return appRegistry;
}
