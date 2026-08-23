import type { Spec } from "@json-render/core";
import { grpcServerStream, resolveIdentity } from "@/json-render/stream/grpc-transport";
import { decodeChatFrame, encodeSendRequest } from "@/json-render/stream/chat-codec";
import { resolveSelectedModelRoute, type ModelRoute } from "./spec-stream";
import { parseTileBoard, tileBoardToSpec, tileObjectSystemPrompt } from "./tile-object";

export interface TileObjectStreamOptions {
  prompt: string;
  conversationId: string;
  route?: ModelRoute;
  signal?: AbortSignal;
  onRaw?: (raw: string) => void;
  onSpec?: (spec: Spec) => void;
  boardId?: string;
}

function abortError(): Error {
  const error = new Error("Generation cancelled");
  error.name = "AbortError";
  return error;
}

/**
 * ChatService text stream → TileBoard JSON → autoTile spec.
 * Same shape as Vercel streamObject/useObject; transport stays tonic ChatService.
 */
export async function generateTileObjectStream(options: TileObjectStreamOptions): Promise<Spec> {
  if (options.signal?.aborted) throw abortError();
  await resolveIdentity();
  const route = options.route ?? (await resolveSelectedModelRoute());
  const boardId = options.boardId ?? "streamed";

  const uiMessages = new TextEncoder().encode(
    JSON.stringify([
      { role: "system", content: tileObjectSystemPrompt() },
      { role: "user", content: options.prompt },
    ]),
  );
  const payload = encodeSendRequest({
    conversationId: options.conversationId,
    uiMessages,
    provider: route.provider,
    model: route.model,
  });
  const { stream, abort } = grpcServerStream("op_chat.chat.ChatService", "Send", payload);
  const reader = stream.getReader();
  const onAbort = () => {
    abort();
    void reader.cancel().catch(() => undefined);
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });

  let assembled = "";
  let lastSpec: Spec | null = null;

  const publish = (text: string) => {
    const board = parseTileBoard(text);
    if (!board || board.tiles.length === 0) return;
    const spec = tileBoardToSpec(board, boardId);
    lastSpec = spec;
    options.onSpec?.(spec);
  };

  try {
    while (true) {
      if (options.signal?.aborted) throw abortError();
      const { done, value } = await reader.read();
      if (done) break;
      const frame = decodeChatFrame(value);
      if (frame.kind === "part" && frame.text) {
        assembled += frame.text;
        options.onRaw?.(assembled);
        publish(assembled);
      } else if (frame.kind === "error") {
        throw new Error(frame.message);
      }
    }
    if (options.signal?.aborted) throw abortError();
    publish(assembled);
    if (!lastSpec) {
      throw new Error("The model returned no tile JSON object.");
    }
    return lastSpec;
  } catch (error) {
    if (options.signal?.aborted) throw abortError();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
}
