import { createSpecStreamCompiler, type Spec } from "@json-render/core";
import { appCatalog } from "@/json-render/catalog/catalog";
import { AUTO_TILE_PROMPT_RULES } from "@/json-render/spec-gen/auto-tile";
import { grpcServerStream, resolveIdentity } from "@/json-render/stream/grpc-transport";
import { decodeChatFrame, encodeSendRequest } from "@/json-render/stream/chat-codec";
import { uiStore } from "@/json-render/store/ui-store";
import { valueToJs } from "@/grpc/google/protobuf/struct";

export interface ModelRoute {
  provider: string;
  model: string;
}

export interface SpecGenerationOptions {
  prompt: string;
  conversationId: string;
  route?: ModelRoute;
  signal?: AbortSignal;
  onRoute?: (route: ModelRoute) => void;
  onRaw?: (raw: string) => void;
  onSpec?: (spec: Spec) => void;
}

export async function resolveSelectedModelRoute(): Promise<ModelRoute> {
  const router = (uiStore.get("/plugins/tched_router") as Record<string, unknown> | undefined) ?? {};
  let provider = typeof router.selected_provider === "string" ? router.selected_provider : "";
  let model = typeof router.selected_model === "string" ? router.selected_model : "";
  if (provider && model) return { provider, model };

  try {
    const { pluginMethods } = await import("@/grpc/plugin-methods");
    const response = await pluginMethods.callSubid<object, { router?: unknown }>(
      "obs.service.tched-router.router.get@v1",
      {},
    );
    const status = (valueToJs(response.router) ?? {}) as { provider?: string; model?: string };
    if (typeof status.provider === "string") provider ||= status.provider;
    if (typeof status.model === "string") model ||= status.model;
  } catch {
    // Empty provider/model deliberately delegates to the bridge's live atomic selection.
  }
  return { provider, model };
}

export function specGenerationSystemPrompt(): string {
  return appCatalog.prompt({
    mode: "standalone",
    system:
      "You are a protocol-driven UI generator for the operation dashboard. Build the requested UI progressively on the current page.",
    customRules: [
      "Output only newline-delimited RFC 6902 SpecStream patches, one complete JSON patch object per line.",
      "Only produce elements and actions declared in this catalog.",
      "The complete catalog is embedded in this system message; never read a filesystem path, mount, workspace file, or external URL to obtain it.",
      "Add /root and its root element early so the current page can begin rendering while later patches arrive.",
      "The spec renders inside the existing system workspace below chat; use a content component such as container or autoTile as the root, not appShell, topbar, sidebar, or contentRegion.",
      "Do not use splitPane in generated specs. Its named start/end slots are reserved for static host specs and ordinary children are not renderable.",
      ...AUTO_TILE_PROMPT_RULES,
      "Use live state bindings for runtime data; never invent credentials or backend values.",
      "Bind plugin data with stateValue.path or streamObject.pluginId where the catalog supports it.",
      "Do not wrap patches in markdown fences and do not add prose.",
    ],
  });
}

export function isRenderableSpec(value: Partial<Spec>): value is Spec {
  return (
    typeof value.root === "string" &&
    value.elements !== null &&
    typeof value.elements === "object" &&
    Object.prototype.hasOwnProperty.call(value.elements, value.root)
  );
}

function abortError(): Error {
  const error = new Error("Generation cancelled");
  error.name = "AbortError";
  return error;
}

/** Shared exact-provider/model SpecStream compiler used by Generate and system views. */
export async function generateSpecStream(options: SpecGenerationOptions): Promise<Spec> {
  if (options.signal?.aborted) throw abortError();
  await resolveIdentity();
  const route = options.route ?? await resolveSelectedModelRoute();
  options.onRoute?.(route);

  const uiMessages = new TextEncoder().encode(JSON.stringify([
    { role: "system", content: specGenerationSystemPrompt() },
    { role: "user", content: options.prompt },
  ]));
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

  const compiler = createSpecStreamCompiler<Spec>();
  let assembled = "";
  let appliedPatchCount = 0;

  const publish = (candidate: Spec) => {
    if (!isRenderableSpec(candidate)) return;
    options.onSpec?.(candidate);
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
        const { result, newPatches } = compiler.push(frame.text);
        if (newPatches.length > 0) {
          appliedPatchCount += newPatches.length;
          publish(result);
        }
      } else if (frame.kind === "error") {
        throw new Error(frame.message);
      }
    }

    if (options.signal?.aborted) throw abortError();
    const finalSpec = compiler.getResult();
    const finalPatchCount = compiler.getPatches().length;
    if (finalPatchCount > appliedPatchCount) publish(finalSpec);
    if (finalPatchCount === 0) {
      throw new Error("The model returned no valid SpecStream patches.");
    }
    if (!isRenderableSpec(finalSpec)) {
      throw new Error("The SpecStream did not produce a renderable root element.");
    }
    return finalSpec;
  } catch (error) {
    if (options.signal?.aborted) throw abortError();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
}
