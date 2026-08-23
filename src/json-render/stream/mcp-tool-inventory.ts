import { api } from "@/lib/api";
import { pluginService } from "@/grpc/client";
import { jsObjectToValue, structToObject, valueToJs } from "@/grpc/google/protobuf/struct";

const PLUGINS = [
  {
    id: "cognitive_mcp",
    capability: "cognitive_mcp.read",
    listMethod: "list_tools",
  },
  {
    id: "compact_mcp",
    capability: "compact_mcp.read",
    listMethod: "get_current_config",
  },
  {
    id: "mcp",
    capability: "mcp.read",
    listMethod: "get_config",
  },
] as const;

function toolNames(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          return String(rec.name ?? rec.id ?? rec.tool ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.tools)) return toolNames(rec.tools);
    if (Array.isArray(rec.result)) return toolNames(rec.result);
  }
  return [];
}

async function callPlugin(pluginId: string, method: string, capability: string): Promise<unknown> {
  const resp = await pluginService.callMethod({
    pluginId,
    objectPath: `/org/opdbus/v1/plugins/${pluginId}`,
    interfaceName: "org.opdbus.v1.PluginV1",
    methodName: method,
    arguments: [jsObjectToValue({})],
    actorId: "operation-dashboard-ui",
    capabilityId: capability,
  });
  const envelope = structToObject(resp.result as Record<string, unknown>);
  return valueToJs(envelope.result) ?? envelope;
}

/**
 * Live inventories for the three MCP plugin objects. This is PluginService.Call,
 * not the StateSync card preview.
 */
export async function loadMcpToolInventories(): Promise<string> {
  const blocks: string[] = [
    "Live MCP plugin inventories from PluginService.CallMethod on the tonic door.",
    "mcp / cognitiveMcp / compactMcp catalog components are StateSync cards; the lists below are the callable surfaces.",
  ];

  try {
    const listed = await api.mcp.listTools();
    const names = toolNames(listed);
    if (names.length) {
      const shown = names.slice(0, 80);
      blocks.push(
        `cognitive_mcp.list_tools (${names.length} tools): ${shown.join(", ")}` +
          (names.length > 80 ? ` … +${names.length - 80} more` : ""),
      );
    } else {
      blocks.push(`cognitive_mcp.list_tools returned no names: ${JSON.stringify(listed).slice(0, 240)}`);
    }
  } catch (error) {
    blocks.push(`cognitive_mcp.list_tools failed: ${(error as Error).message}`);
  }

  for (const plugin of PLUGINS) {
    if (plugin.id === "cognitive_mcp") continue;
    try {
      const result = await callPlugin(plugin.id, plugin.listMethod, plugin.capability);
      const text = JSON.stringify(result);
      blocks.push(
        `${plugin.id}.${plugin.listMethod}: ${text.length > 400 ? `${text.slice(0, 400)}…` : text}`,
      );
    } catch (error) {
      blocks.push(`${plugin.id}.${plugin.listMethod} failed: ${(error as Error).message}`);
    }
  }

  return blocks.join("\n");
}
