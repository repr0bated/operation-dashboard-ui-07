/**
 * Lifelong account identities (container = sled = identity).
 *
 * Naming:
 *   - session_id / sessid / container name = lifelong **account**
 *   - "session" in everyday speech = transient **activity** (chat/work episode)
 *
 * Soul, namespace memory, and future permission/boundary grants bind to the
 * account sessid — never to a transient activity id.
 *
 * Source of truth on host: /var/lib/opdbus-runtime/identities/{role}/identity.json
 */

/** Header that declares which lifelong account a call is acting as. */
export const ACCOUNT_SESSION_HEADER = "x-opdbus-account-session-id";

/** Optional role label for the declared account (chatbot | jeremy | …). */
export const ACCOUNT_ROLE_HEADER = "x-opdbus-account-role";

/**
 * Declares whether this account may use public internet egress.
 * `0` = mesh / control-plane only (production chatbot). `1` = internet allowed.
 * Network enforcement (OpenFlow / route) will key off this later.
 */
export const ACCOUNT_INTERNET_HEADER = "x-opdbus-account-internet";

const INTERNET_OVERRIDE_PREFIX = "opdbus.account.internet.";

export type AccountRole = "chatbot" | "jeremy" | "host" | (string & {});

/**
 * Capability boundary for an account. Permissions/grants will key off this
 * once enforcement lands; today it is the declared policy of record.
 */
export type AccountGuardrail = {
  /** Direct backplane / host mutation (sv, OVS, Incus, shell, …). */
  mayExecute: boolean;
  /** Delegate work by calling agents. */
  mayCallAgents: boolean;
  /**
   * Public internet egress. Production chatbot is **false** (mesh / UDS only).
   * Operator can flip via {@link setAccountInternetEnabled} for lab use;
   * enforcement of the off state is a later network gate.
   */
  internetEnabled: boolean;
  /** Declared job of this account. */
  roles: ReadonlyArray<
    "orchestrator" | "planner" | "suggestion_giver" | "problem_solver" | (string & {})
  >;
  /** One-line policy for UI / prompts. */
  summary: string;
};

export type AccountIdentity = {
  /** Lifelong account id (= Incus container name = identity sled key). */
  sessionId: string;
  role: AccountRole;
  /** Short label for UI. */
  label: string;
  /** WireGuard pubkey (base64) — cryptographic root of the account. */
  pubkey: string;
  /** Mesh address when known (CIDR). */
  meshIp: string;
  /** Host path of the sealed identity directory, when known. */
  runtimeDir?: string;
  /** Permission / boundary policy for this account. */
  guardrail: AccountGuardrail;
};

/** Chatbot account policy: orchestrate and advise — never execute; no internet in prod. */
export const CHATBOT_GUARDRAIL: AccountGuardrail = {
  mayExecute: false,
  mayCallAgents: true,
  internetEnabled: false,
  roles: ["orchestrator", "planner", "suggestion_giver", "problem_solver"],
  summary:
    "No direct execution. Orchestrates, plans, suggests, and solves problems by calling agents only. Production: no public internet.",
};

/** Operator account — may execute (subject to capability grants). */
export const JEREMY_GUARDRAIL: AccountGuardrail = {
  mayExecute: true,
  mayCallAgents: true,
  internetEnabled: true,
  roles: ["operator"],
  summary: "Human operator. May execute within granted capabilities.",
};

/**
 * Control-plane chatbot account. Host Assistant UI (soul / namespace memory)
 * acts as this identity.
 */
export const CHATBOT_ACCOUNT: AccountIdentity = {
  sessionId: "bea37ecb-92be-197c-660f-09e806f1a34f",
  role: "chatbot",
  label: "assistant chatbot",
  pubkey: "VaRh9EUieQxA3zIoOj3qNiNIqZoPGpqztPU4muyF1zM=",
  meshIp: "100.69.0.10/32",
  runtimeDir: "/var/lib/opdbus-runtime/identities/chatbot",
  guardrail: CHATBOT_GUARDRAIL,
};

/** Operator account (jeremy). */
export const JEREMY_ACCOUNT: AccountIdentity = {
  sessionId: "f036f8d8-aabb-c5f2-49c9-18dac19f41ea",
  role: "jeremy",
  label: "jeremy",
  pubkey: "GEMLT/+I81zs5HDPsOF22ntqGf71OEy6eFKMm7P7Dzk=",
  meshIp: "100.69.0.2/32",
  runtimeDir: "/var/lib/opdbus-runtime/identities/jeremy",
  guardrail: JEREMY_GUARDRAIL,
};

/** Account the host Assistant Gateway is bound to. */
export const ASSISTANT_ACCOUNT: AccountIdentity = CHATBOT_ACCOUNT;

const BY_ROLE: Record<string, AccountIdentity> = {
  chatbot: CHATBOT_ACCOUNT,
  jeremy: JEREMY_ACCOUNT,
};

const BY_SESSION: Record<string, AccountIdentity> = {
  [CHATBOT_ACCOUNT.sessionId]: CHATBOT_ACCOUNT,
  [JEREMY_ACCOUNT.sessionId]: JEREMY_ACCOUNT,
};

export function getAccountByRole(role: string): AccountIdentity | undefined {
  return BY_ROLE[role];
}

export function getAccountBySessionId(sessionId: string): AccountIdentity | undefined {
  return BY_SESSION[sessionId];
}

function internetOverrideKey(sessionId: string): string {
  return `${INTERNET_OVERRIDE_PREFIX}${sessionId}`;
}

/**
 * Effective internet switch for an account.
 * Operator override (localStorage) wins over the declared guardrail default.
 */
export function getAccountInternetEnabled(account: AccountIdentity): boolean {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(internetOverrideKey(account.sessionId));
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {
      /* ignore quota / private mode */
    }
  }
  return account.guardrail.internetEnabled;
}

/** Persist operator override for the internet switch (lab vs production posture). */
export function setAccountInternetEnabled(
  account: AccountIdentity,
  enabled: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(internetOverrideKey(account.sessionId), enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Clear override so the declared guardrail default applies again. */
export function clearAccountInternetOverride(account: AccountIdentity): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(internetOverrideKey(account.sessionId));
  } catch {
    /* ignore */
  }
}

/** Headers that declare an account principal for permission / boundary checks. */
export function accountHeaders(account: AccountIdentity): Record<string, string> {
  const internet = getAccountInternetEnabled(account);
  return {
    [ACCOUNT_SESSION_HEADER]: account.sessionId,
    [ACCOUNT_ROLE_HEADER]: account.role,
    [ACCOUNT_INTERNET_HEADER]: internet ? "1" : "0",
  };
}

export function listKnownAccounts(): AccountIdentity[] {
  return [CHATBOT_ACCOUNT, JEREMY_ACCOUNT];
}
