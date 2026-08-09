/**
 * Chatbot account cognitive surface — soul + namespaces via `cognitive_mcp`.
 *
 * Replaces legacy `assistant.v1.SoulService` / `NamespaceMemoryService`
 * (not mounted on the bridge). Wire path:
 *   operation.v1.PluginService/CallMethod → cognitive_mcp → MCP loopback
 *
 * Every call stamps the chatbot lifelong account headers for permission /
 * boundary binding.
 */
import { pluginService, type GrpcCallOptions } from "./client";
import { jsObjectToValue, structToObject, valueToJs } from "./google/protobuf/struct";
import { ASSISTANT_ACCOUNT } from "@/lib/accounts";

const PLUGIN_ID = "cognitive_mcp";
const OBJECT_PATH = "/org/opdbus/v1/plugins/cognitive_mcp";
const INTERFACE = "org.opdbus.v1.PluginV1";
const ACTOR = "dashboard-assistant";
const ASSISTANT_CALL: GrpcCallOptions = { account: ASSISTANT_ACCOUNT };

/** Chatbot soul namespace owned by the lifelong chatbot account. */
export const CHATBOT_SOUL_NAMESPACE = "soul:chatbot";
const SOUL_ENTRY_KEY = "soul";

export type ChatbotSoul = {
  agentId: string;
  namespace: string;
  identity: string;
  personality: string;
  traits: Record<string, unknown>;
  version: number;
  updatedAt?: string;
};

export type ChatbotNamespace = {
  name: string;
  /** Derived agent / owner label when the name is a soul: or container: ns. */
  agentId: string;
  entryCount: number;
};

async function callCognitive<T>(
  methodName: string,
  args: Record<string, unknown>,
  capabilityId: string,
): Promise<T> {
  const resp = await pluginService.callMethod(
    {
      pluginId: PLUGIN_ID,
      objectPath: OBJECT_PATH,
      interfaceName: INTERFACE,
      methodName,
      arguments: [jsObjectToValue(args)],
      actorId: ACTOR,
      capabilityId,
    },
    ASSISTANT_CALL,
  );

  const envelope = structToObject(resp.result as Record<string, unknown>);
  if (envelope.success === false) {
    const err = envelope.error;
    const message =
      typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : `cognitive_mcp.${methodName} failed`;
    throw new Error(message);
  }

  const inner = valueToJs(envelope.result);
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as T;
  }
  return (inner ?? envelope) as T;
}

function agentIdFromNamespace(name: string): string {
  if (name === CHATBOT_SOUL_NAMESPACE) return "chatbot";
  if (name.startsWith("soul:user-container:")) {
    return name.slice("soul:user-container:".length) || name;
  }
  if (name.startsWith("soul:")) return name.slice("soul:".length) || name;
  if (name.startsWith("container:")) return name.slice("container:".length) || name;
  if (name.startsWith("agent:")) return name.slice("agent:".length) || name;
  return name;
}

function soulFromEntry(
  namespace: string,
  raw: unknown,
): ChatbotSoul {
  const value =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return { identity: raw } as Record<string, unknown>;
          }
        })()
      : raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};

  const traits =
    value.traits && typeof value.traits === "object" && !Array.isArray(value.traits)
      ? (value.traits as Record<string, unknown>)
      : {};

  return {
    agentId: agentIdFromNamespace(namespace),
    namespace,
    identity: String(value.identity ?? value.identity_id ?? ""),
    personality: String(value.personality ?? ""),
    traits,
    version: Number(value.version ?? 1) || 1,
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : undefined,
  };
}

export const chatbotCognitive = {
  /** Ensure the chatbot soul namespace exists (idempotent). */
  async ensureChatbotSoul(): Promise<void> {
    await callCognitive(
      "memory_store",
      {
        namespace: CHATBOT_SOUL_NAMESPACE,
        key: SOUL_ENTRY_KEY,
        value: {
          owner: "chatbot",
          identity_id: ASSISTANT_ACCOUNT.sessionId,
          identity: ASSISTANT_ACCOUNT.label,
          personality: "",
          traits: {},
          purpose: "soul",
          version: 1,
        },
        namespace_kind: "agent",
        tags: ["soul", "chatbot"],
      },
      "cognitive_mcp.invoke",
    );
  },

  async listNamespaces(): Promise<ChatbotNamespace[]> {
    const out = await callCognitive<{ namespaces?: string[] }>(
      "memory_list_namespaces",
      {},
      "cognitive_mcp.read",
    );
    const names = Array.isArray(out.namespaces) ? out.namespaces : [];
    return names.map((name) => ({
      name,
      agentId: agentIdFromNamespace(name),
      entryCount: 0,
    }));
  },

  async listSouls(): Promise<ChatbotSoul[]> {
    const namespaces = await this.listNamespaces();
    const soulNs = namespaces.filter((n) => n.name.startsWith("soul:"));
    if (soulNs.length === 0) {
      // Bootstrap chatbot soul so the page has a live account-scoped record.
      await this.ensureChatbotSoul();
      return [
        {
          agentId: "chatbot",
          namespace: CHATBOT_SOUL_NAMESPACE,
          identity: ASSISTANT_ACCOUNT.label,
          personality: "",
          traits: {},
          version: 1,
        },
      ];
    }

    const souls: ChatbotSoul[] = [];
    for (const ns of soulNs) {
      try {
        const retrieved = await callCognitive<{
          namespace?: string;
          value?: unknown;
          entry?: { value?: unknown };
        }>("memory_retrieve", { namespace: ns.name, key: SOUL_ENTRY_KEY }, "cognitive_mcp.read");
        const raw = retrieved.value ?? retrieved.entry?.value ?? retrieved;
        souls.push(soulFromEntry(ns.name, raw));
      } catch {
        souls.push({
          agentId: ns.agentId,
          namespace: ns.name,
          identity: "",
          personality: "",
          traits: {},
          version: 1,
        });
      }
    }
    return souls;
  },

  async updateSoul(input: {
    agentId: string;
    identity?: string;
    personality?: string;
    traits?: Record<string, unknown>;
  }): Promise<ChatbotSoul> {
    const namespace =
      input.agentId === "chatbot" || !input.agentId
        ? CHATBOT_SOUL_NAMESPACE
        : input.agentId.startsWith("soul:")
          ? input.agentId
          : `soul:${input.agentId}`;

    let existing: ChatbotSoul | undefined;
    try {
      const list = await this.listSouls();
      existing = list.find((s) => s.namespace === namespace || s.agentId === input.agentId);
    } catch {
      /* create fresh */
    }

    const next: ChatbotSoul = {
      agentId: agentIdFromNamespace(namespace),
      namespace,
      identity: input.identity ?? existing?.identity ?? "",
      personality: input.personality ?? existing?.personality ?? "",
      traits: input.traits ?? existing?.traits ?? {},
      version: (existing?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    await callCognitive(
      "memory_store",
      {
        namespace,
        key: SOUL_ENTRY_KEY,
        value: {
          owner: next.agentId === "chatbot" ? "chatbot" : "user_container",
          identity_id: ASSISTANT_ACCOUNT.sessionId,
          identity: next.identity,
          personality: next.personality,
          traits: next.traits,
          version: next.version,
          updated_at: next.updatedAt,
          purpose: "soul",
        },
        namespace_kind: "agent",
        tags: ["soul", next.agentId],
      },
      "cognitive_mcp.invoke",
    );

    return next;
  },

  async deleteSoul(agentId: string): Promise<void> {
    const namespace =
      agentId === "chatbot"
        ? CHATBOT_SOUL_NAMESPACE
        : agentId.startsWith("soul:")
          ? agentId
          : `soul:${agentId}`;
    await callCognitive(
      "memory_delete",
      { namespace, key: SOUL_ENTRY_KEY },
      "cognitive_mcp.invoke",
    );
  },
};
