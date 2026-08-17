/**
 * Assistant system-prompt config shared by Assistant (edit) and Chat (send).
 *
 * Immutable core rules are display-only in the UI (backend enforces its own
 * fixed prompt). Tunable operator preferences persist in localStorage until
 * a dedicated config API lands.
 */

/** Immutable core rules — shown read-only; not editable from the UI. */
export const IMMUTABLE_PROMPT = `## CRITICAL RULES (Immutable)

1. **ALWAYS USE TOOLS** — For ANY system operation, you MUST call the appropriate tool.
   Never describe steps for the operator to run manually.

2. **NEVER SUGGEST CLI COMMANDS** — Do NOT mention or suggest commands like:
   - ovs-vsctl, ovs-ofctl → use ovs_* tools
   - systemctl, service, s6-rc, s6-svc → use dbus_s6_* tools
   - ip, ifconfig, nmcli → use network tools

3. **NATIVE PROTOCOLS ONLY**:
   - D-Bus for s6, NetworkManager, PackageKit
   - OVSDB JSON-RPC for Open vSwitch
   - rtnetlink for kernel networking
   - NEVER shell out to CLI tools


4. **TOOL CALL FORMAT**:
   <tool_call>tool_name({"arg1": "value1"})</tool_call>

5. **SECURITY**: Never expose secrets, keys, or credentials in responses.
   Validate all inputs before tool execution.

6. **EXPLAIN → ACT → REPORT**: Always explain what you will do,
   execute the tool, then report the result.`;

export const DEFAULT_TUNABLE_PROMPT = `## Operator Preferences (Tunable)

# Response style
response_verbosity: concise
explanation_depth: brief
confirm_destructive: true

# Tool behavior
auto_chain_tools: true
max_tool_calls_per_turn: 5
show_raw_tool_output: false

# Context
environment: production
default_bus: system
preferred_service_manager: s6

# Custom instructions
custom_instructions: |
  Prioritize safety over speed.
  Always check service status before restart.
  Log all destructive operations.`;

const TUNABLE_STORAGE_KEY = "opdbus.assistant.system-prompt.tunable";

/** Load saved tunable preferences (falls back to defaults). */
export function getTunableSystemPrompt(): string {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(TUNABLE_STORAGE_KEY);
      if (raw !== null) return raw;
    } catch {
      /* ignore quota / private mode */
    }
  }
  return DEFAULT_TUNABLE_PROMPT;
}

/** Persist tunable preferences for Chat send + Assistant editor. */
export function setTunableSystemPrompt(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TUNABLE_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Clear override so the next read returns defaults. */
export function clearTunableSystemPrompt(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TUNABLE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Full prompt preview / payload: immutable core + saved tunable. */
export function getEffectiveSystemPrompt(tunable = getTunableSystemPrompt()): string {
  return `${IMMUTABLE_PROMPT}\n\n${tunable}`;
}
