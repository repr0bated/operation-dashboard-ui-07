import { useCallback, useRef, useState, type FormEvent } from "react";
import type { Spec } from "@json-render/core";
import { uiStore } from "@/json-render/store/ui-store";
import { generateTileObjectStream } from "./tile-object-stream";

let conversationSequence = 0;

function makeId(prefix: string): string {
  conversationSequence += 1;
  return `${prefix}-${Date.now()}-${conversationSequence}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Client hook for streamed tile data. Analogous to Vercel `useObject`:
 * submit a prompt, receive progressive JSON, render via catalog tiles.
 */
export function useTileObject() {
  const [prompt, setPrompt] = useState(
    "Miami weather plus control-plane uptime and sealed plugin count.",
  );
  const [raw, setRaw] = useState("");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (requestedPrompt: string) => {
      const text = requestedPrompt.trim();
      if (!text || sending) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSending(true);
      setError(null);
      setRaw("");
      setSpec(null);
      try {
        await generateTileObjectStream({
          prompt: text,
          conversationId: makeId("tiles"),
          signal: controller.signal,
          onRaw: setRaw,
          onSpec: (candidate) => {
            setSpec(candidate);
            uiStore.set("/generate/spec", candidate);
          },
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (abortRef.current === controller) {
          setSending(false);
          abortRef.current = null;
        }
      }
    },
    [sending],
  );

  const generate = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      return submit(prompt);
    },
    [prompt, submit],
  );

  return { prompt, setPrompt, raw, spec, error, sending, generate, submit };
}
