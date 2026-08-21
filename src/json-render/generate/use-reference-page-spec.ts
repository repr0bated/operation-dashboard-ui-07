import { useCallback, useEffect, useRef, useState } from "react";
import type { Spec } from "@json-render/core";
import type { LegacyPageReference } from "@/json-render/navigation/reference-pages";
import { buildReferencePagePrompt } from "@/json-render/navigation/reference-pages";
import {
  generateSpecStream,
  isRenderableSpec,
  type ModelRoute,
} from "./spec-stream";

const CACHE_PREFIX = "operation-dashboard:reference-canvas:";
const memoryCache = new Map<string, Spec>();
let conversationSequence = 0;

function makeConversationId(route: string): string {
  const routeKey = route.replace(/[^a-z0-9]/gi, "-");
  conversationSequence += 1;
  return `system-view-${routeKey}-${Date.now()}-${conversationSequence}-${Math.random().toString(36).slice(2, 9)}`;
}

function cacheKey(route: string): string {
  return `${CACHE_PREFIX}${route}`;
}

export function readReferencePageCache(route: string): Spec | null {
  const memory = memoryCache.get(route);
  if (memory) return memory;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(route));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Spec>;
    if (!isRenderableSpec(value)) return null;
    memoryCache.set(route, value);
    return value;
  } catch {
    return null;
  }
}

export function writeReferencePageCache(route: string, spec: Spec): void {
  memoryCache.set(route, spec);
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey(route), JSON.stringify(spec));
  } catch {
    // A large generated screen may exceed storage quota; memory caching still works.
  }
}

export function clearReferencePageCache(route: string): void {
  memoryCache.delete(route);
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(cacheKey(route));
}

export function useReferencePageSpec(reference: LegacyPageReference | null) {
  const [spec, setSpec] = useState<Spec | null>(() =>
    reference ? readReferencePageCache(reference.route) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelRoute, setModelRoute] = useState<ModelRoute | null>(null);
  const [revision, setRevision] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (force = false) => {
    if (!reference) return;
    const cached = force ? null : readReferencePageCache(reference.route);
    if (cached) {
      setSpec(cached);
      setLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (force) clearReferencePageCache(reference.route);
    setSpec(null);
    setLoading(true);
    setError(null);
    setModelRoute(null);

    try {
      const finalSpec = await generateSpecStream({
        prompt: buildReferencePagePrompt(reference),
        conversationId: makeConversationId(reference.route),
        signal: controller.signal,
        onRoute: setModelRoute,
        onSpec: setSpec,
      });
      writeReferencePageCache(reference.route, finalSpec);
      setRevision((value) => value + 1);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError((reason as Error).message);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [reference]);

  useEffect(() => {
    if (!reference) {
      abortRef.current?.abort();
      setSpec(null);
      setLoading(false);
      setError(null);
      setModelRoute(null);
      return;
    }
    void generate(false);
    return () => abortRef.current?.abort();
  }, [reference, generate]);

  return {
    spec,
    loading,
    error,
    modelRoute,
    revision,
    regenerate: () => generate(true),
    retry: () => generate(false),
  };
}
