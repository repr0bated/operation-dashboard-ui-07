import { useCallback, useRef, useState, type FormEvent } from "react";
import type { Spec } from "@json-render/core";
import { grpcServerStream, resolveIdentity } from "@/json-render/stream/grpc-transport";
import { decodeChatFrame, encodeSendRequest } from "@/json-render/stream/chat-codec";
import { uiStore } from "@/json-render/store/ui-store";
import { valueToJs } from "@/grpc/google/protobuf/struct";
import {
  generateResponseSchema,
  parseGeneratedSpec,
} from "./generate-schema";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function resolveRoute(): Promise<{ provider: string; model: string }> {
  const router = (uiStore.get("/plugins/tched_router") as Record<string, unknown> | undefined) ?? {};
  let provider = typeof router.selected_provider === "string" ? router.selected_provider : "";
  let model = typeof router.selected_model === "string" ? router.selected_model : "";
  if (provider && model) return { provider, model };
  try {
    const { pluginMethods } = await import("@/grpc/plugin-methods");
    const resp = await pluginMethods.callSubid<object, { router?: unknown }>(
      "obs.service.tched-router.router.get@v1",
      {},
    );
    const status = (valueToJs(resp.router) ?? {}) as { provider?: string; model?: string };
    if (typeof status.provider === "string") provider = provider || status.provider;
    if (typeof status.model === "string") model = model || status.model;
  } catch {
    /* bridge uses live selected_* */
  }
  return { provider, model };
}

function systemPrompt(): string {
  const schema = generateResponseSchema();
  return [
    "You are a protocol-driven UI generator for the operation dashboard.",
    "Return ONE JSON object that validates against the JSON Schema below.",
    "Do not emit RFC 6902 JSON Patch lines. Do not wrap in markdown. No prose.",
    "elements is an array of discriminated objects (type is the discriminator), not a map.",
    "children are element id strings. Bind live plugin data with stateValue.path like antigravity.auth.token_valid or streamObject.pluginId.",
    "Chat uses antigravityChatContainer plus chatMessage with repeat.statePath /streams/stream_antigravity_01/messages.",
    "response_schema:",
    JSON.stringify(schema),
  ].join("\n");
}

export function useGenerateSpec() {
  const [prompt, setPrompt] = useState(
    "Build an antigravity usage card with auth status and a live chat pane.",
  );
  const [raw, setRaw] = useState("");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const conversationId = useRef(makeId("generate"));

  const generate = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const text = prompt.trim();
      if (!text || sending) return;

      setSending(true);
      setError(null);
      setRaw("");
      setSpec(null);
      abortRef.current?.();
      await resolveIdentity();
      const route = await resolveRoute();

      const uiMessages = new TextEncoder().encode(
        JSON.stringify([
          { role: "system", content: systemPrompt() },
          {
            role: "user",
            content: text,
            response_schema: generateResponseSchema(),
          },
        ]),
      );
      const payload = encodeSendRequest({
        conversationId: conversationId.current,
        uiMessages,
        provider: route.provider,
        model: route.model,
      });

      const { stream, abort } = grpcServerStream(
        "op_chat.chat.ChatService",
        "Send",
        payload,
      );
      abortRef.current = abort;

      let assembled = "";
      try {
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const frame = decodeChatFrame(value);
          if (frame.kind === "part" && frame.text) {
            assembled += frame.text;
            setRaw(assembled);
          } else if (frame.kind === "error") {
            throw new Error(frame.message);
          }
        }
        const parsed = parseGeneratedSpec(assembled);
        setSpec(parsed.spec);
        uiStore.set("/generate/spec", parsed.spec);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [prompt, sending],
  );

  return { prompt, setPrompt, raw, spec, error, sending, generate };
}
