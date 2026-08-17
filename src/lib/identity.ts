/**
 * Dashboard Ghostbridge identity bootstrap + device pairing.
 *
 * Resolution order (first hit wins for gRPC headers):
 *   1. Runtime: window.__OPDBUS_CONFIG__.{ghostbridgeFootprint,ghostbridgeTraceId}
 *   2. localStorage pair session (from POST /pair)
 *   3. Live sled: GET /api/identity/sled when is_valid
 *   4. Build-time env: VITE_GHOSTBRIDGE_* (development fallback only)
 *
 * When nothing yields a footprint+trace, the UI shows PairingPage.
 *
 * Ghostbridge footprint/trace authenticate the *caller device/host sled*.
 * Lifelong account principals (chatbot / jeremy sessids) are separate — see
 * `src/lib/accounts.ts` and {@link IdentityHeaderOptions.account}.
 */

import {
  accountHeaders,
  type AccountIdentity,
} from "@/lib/accounts";

const STORAGE_KEY = "opdbus.pair.session";

export type PairSession = {
  token: string;
  hashed_footprint: string;
  trace_id: string;
  device_name?: string;
  source: "pair" | "sled" | "config" | "env";
  saved_at: number;
};

export type IdentityStatus =
  | { state: "loading" }
  | { state: "ready"; identity: PairSession }
  | { state: "needs_pairing"; reason: string };

function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const runtime = window.__OPDBUS_CONFIG__?.apiBaseUrl;
    if (runtime) return runtime.replace(/\/+$/, "");
  }
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  return "/api";
}

function readStoredSession(): PairSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PairSession;
    if (!parsed?.hashed_footprint || !parsed?.trace_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: PairSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  // Keep runtime config in sync for any code that reads __OPDBUS_CONFIG__.
  if (typeof window !== "undefined") {
    window.__OPDBUS_CONFIG__ = {
      ...window.__OPDBUS_CONFIG__,
      ghostbridgeFootprint: session.hashed_footprint,
      ghostbridgeTraceId: session.trace_id,
    };
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function fromConfig(): PairSession | null {
  if (typeof window === "undefined") return null;
  const cfg = window.__OPDBUS_CONFIG__;
  const footprint = cfg?.ghostbridgeFootprint?.trim();
  const trace = cfg?.ghostbridgeTraceId?.trim();
  if (footprint && trace) {
    return {
      token: "",
      hashed_footprint: footprint,
      trace_id: trace,
      source: "config",
      saved_at: Date.now(),
    };
  }
  return null;
}

function fromEnv(): PairSession | null {
  const footprint = (import.meta.env.VITE_GHOSTBRIDGE_FOOTPRINT as string | undefined)?.trim();
  const trace = (import.meta.env.VITE_GHOSTBRIDGE_TRACE_ID as string | undefined)?.trim();
  if (footprint && trace) {
    return {
      token: "",
      hashed_footprint: footprint,
      trace_id: trace,
      source: "env",
      saved_at: Date.now(),
    };
  }
  return null;
}

async function fromSled(): Promise<PairSession | null> {
  try {
    const res = await fetch(`${resolveApiBase()}/identity/sled`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      is_valid?: boolean;
      hashed_footprint?: string;
      trace_id?: string;
    };
    if (!body.is_valid || !body.hashed_footprint || !body.trace_id) return null;
    if (body.hashed_footprint.replace(/0/g, "") === "") return null;
    return {
      token: "",
      hashed_footprint: body.hashed_footprint,
      trace_id: body.trace_id,
      source: "sled",
      saved_at: Date.now(),
    };
  } catch {
    return null;
  }
}

/** Resolve identity without side effects (except config mirror on success). */
export async function resolveIdentity(): Promise<IdentityStatus> {
  const fromCfg = fromConfig();
  if (fromCfg) {
    saveSession(fromCfg);
    return { state: "ready", identity: fromCfg };
  }

  const stored = readStoredSession();
  const sled = await fromSled();
  if (sled) {
    if (
      stored?.hashed_footprint &&
      stored.hashed_footprint === sled.hashed_footprint &&
      stored.trace_id === sled.trace_id
    ) {
      saveSession({ ...stored, source: stored.source });
      return { state: "ready", identity: stored };
    }
    saveSession(sled);
    return { state: "ready", identity: sled };
  }

  if (stored?.source === "pair" && stored.token && stored.hashed_footprint && stored.trace_id) {
    saveSession(stored);
    return { state: "ready", identity: stored };
  }

  // Build-time identities go stale whenever the audited sled advances. Keep
  // them only as an offline development fallback after a live refresh fails.
  const fromEnvironment = fromEnv();
  if (fromEnvironment) {
    saveSession(fromEnvironment);
    return { state: "ready", identity: fromEnvironment };
  }

  // Stale stored session without live sled still usable for headers if present
  if (stored?.hashed_footprint && stored?.trace_id) {
    saveSession(stored);
    return { state: "ready", identity: stored };
  }

  return {
    state: "needs_pairing",
    reason: "No Ghostbridge identity (config, env, pair session, or valid sled).",
  };
}

export type IdentityHeaderOptions = {
  /**
   * Lifelong account principal this call is acting as (container sessid).
   * Used for permission / boundary binding. Distinct from Ghostbridge
   * footprint (caller device) and from transient activity sessions.
   */
  account?: AccountIdentity;
};

/** Headers for gRPC-Web / REST calls. Empty object if unpaired. */
export function identityHeaders(opts?: IdentityHeaderOptions): Record<string, string> {
  const cfg = typeof window !== "undefined" ? window.__OPDBUS_CONFIG__ : undefined;
  let footprint = cfg?.ghostbridgeFootprint?.trim() || "";
  let traceId = cfg?.ghostbridgeTraceId?.trim() || "";
  let token = "";

  if (!footprint || !traceId) {
    const stored = readStoredSession();
    if (stored) {
      footprint = stored.hashed_footprint;
      traceId = stored.trace_id;
      token = stored.token || "";
    }
  } else {
    token = readStoredSession()?.token || "";
  }

  if (!footprint) {
    footprint = (import.meta.env.VITE_GHOSTBRIDGE_FOOTPRINT as string | undefined)?.trim() || "";
  }
  if (!traceId) {
    traceId = (import.meta.env.VITE_GHOSTBRIDGE_TRACE_ID as string | undefined)?.trim() || "";
  }

  const headers: Record<string, string> = {};
  if (footprint) headers["x-ghostbridge-footprint"] = footprint;
  if (traceId) headers["x-ghostbridge-trace-id"] = traceId;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts?.account) {
    Object.assign(headers, accountHeaders(opts.account));
  }
  return headers;
}

export function hasIdentity(): boolean {
  const h = identityHeaders();
  return Boolean(h["x-ghostbridge-footprint"] && h["x-ghostbridge-trace-id"]);
}

/** Exchange pairing code for token + sled identity. */
export async function pairWithCode(
  code: string,
  deviceName = "dashboard",
): Promise<PairSession> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${origin}/pair`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Pairing-Code": code.trim().toUpperCase(),
    },
    body: JSON.stringify({
      device_name: deviceName,
      device_type: "web",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        `Pairing failed (HTTP ${res.status})`,
    );
  }
  const token = (body as { token?: string }).token || "";
  const hashed_footprint =
    (body as { hashed_footprint?: string }).hashed_footprint || "";
  const trace_id = (body as { trace_id?: string }).trace_id || "";
  if (!hashed_footprint || !trace_id) {
    throw new Error("Pair response missing identity fields");
  }
  const session: PairSession = {
    token,
    hashed_footprint,
    trace_id,
    device_name: deviceName,
    source: "pair",
    saved_at: Date.now(),
  };
  saveSession(session);
  return session;
}

/** Mint a new pairing code (mesh/localhost admin only). */
export async function generatePairingCode(): Promise<string> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${origin}/admin/paircode/new`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        `Could not mint pairing code (HTTP ${res.status})`,
    );
  }
  const code = (body as { pairing_code?: string }).pairing_code;
  if (!code) throw new Error("No pairing_code in response");
  return code;
}
