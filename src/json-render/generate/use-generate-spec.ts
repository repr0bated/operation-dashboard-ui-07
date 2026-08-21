import { useCallback, useRef, useState, type FormEvent } from "react";
import type { Spec } from "@json-render/core";
import { uiStore } from "@/json-render/store/ui-store";
import { generateSpecStream } from "./spec-stream";

let conversationSequence = 0;

function makeId(prefix: string): string {
  conversationSequence += 1;
  return `${prefix}-${Date.now()}-${conversationSequence}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useGenerateSpec() {
  const [prompt, setPrompt] = useState(
    "Build an antigravity usage card with auth status and a live chat pane.",
  );
  const [raw, setRaw] = useState("");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generatePrompt = useCallback(
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
        await generateSpecStream({
          prompt: text,
          conversationId: makeId("generate"),
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
      return generatePrompt(prompt);
    },
    [generatePrompt, prompt],
  );

  return { prompt, setPrompt, raw, spec, error, sending, generate, generatePrompt };
}
