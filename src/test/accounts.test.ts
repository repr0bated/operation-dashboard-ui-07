import { afterEach, describe, expect, it } from "vitest";
import {
  ACCOUNT_INTERNET_HEADER,
  ACCOUNT_ROLE_HEADER,
  ACCOUNT_SESSION_HEADER,
  ASSISTANT_ACCOUNT,
  CHATBOT_ACCOUNT,
  JEREMY_ACCOUNT,
  accountHeaders,
  clearAccountInternetOverride,
  getAccountByRole,
  getAccountBySessionId,
  getAccountInternetEnabled,
  setAccountInternetEnabled,
} from "@/lib/accounts";
import { identityHeaders } from "@/lib/identity";

afterEach(() => {
  clearAccountInternetOverride(CHATBOT_ACCOUNT);
  clearAccountInternetOverride(JEREMY_ACCOUNT);
  delete window.__OPDBUS_CONFIG__;
});

describe("lifelong account identities", () => {
  it("binds the Assistant Gateway to the chatbot account sessid", () => {
    expect(ASSISTANT_ACCOUNT).toBe(CHATBOT_ACCOUNT);
    expect(ASSISTANT_ACCOUNT.sessionId).toBe("bea37ecb-92be-197c-660f-09e806f1a34f");
    expect(ASSISTANT_ACCOUNT.role).toBe("chatbot");
  });

  it("declares the chatbot guardrail: no execution, agents only, no internet", () => {
    expect(ASSISTANT_ACCOUNT.guardrail.mayExecute).toBe(false);
    expect(ASSISTANT_ACCOUNT.guardrail.mayCallAgents).toBe(true);
    expect(ASSISTANT_ACCOUNT.guardrail.internetEnabled).toBe(false);
    expect(ASSISTANT_ACCOUNT.guardrail.roles).toEqual([
      "orchestrator",
      "planner",
      "suggestion_giver",
      "problem_solver",
    ]);
  });

  it("looks up accounts by role and sessid", () => {
    expect(getAccountByRole("jeremy")?.sessionId).toBe(JEREMY_ACCOUNT.sessionId);
    expect(getAccountBySessionId(CHATBOT_ACCOUNT.sessionId)?.role).toBe("chatbot");
  });

  it("stamps account headers for permission / boundary binding", () => {
    const stamped = accountHeaders(CHATBOT_ACCOUNT);
    expect(stamped[ACCOUNT_SESSION_HEADER]).toBe(CHATBOT_ACCOUNT.sessionId);
    expect(stamped[ACCOUNT_ROLE_HEADER]).toBe("chatbot");
    expect(stamped[ACCOUNT_INTERNET_HEADER]).toBe("0");
  });

  it("toggles the chatbot internet switch and stamps the header", () => {
    expect(getAccountInternetEnabled(CHATBOT_ACCOUNT)).toBe(false);
    setAccountInternetEnabled(CHATBOT_ACCOUNT, true);
    expect(getAccountInternetEnabled(CHATBOT_ACCOUNT)).toBe(true);
    expect(accountHeaders(CHATBOT_ACCOUNT)[ACCOUNT_INTERNET_HEADER]).toBe("1");
    setAccountInternetEnabled(CHATBOT_ACCOUNT, false);
    expect(accountHeaders(CHATBOT_ACCOUNT)[ACCOUNT_INTERNET_HEADER]).toBe("0");
  });

  it("merges account headers into Ghostbridge identity headers", () => {
    window.__OPDBUS_CONFIG__ = {
      ghostbridgeFootprint: "ab".repeat(32),
      ghostbridgeTraceId: "cd".repeat(16),
    };
    const headers = identityHeaders({ account: CHATBOT_ACCOUNT });
    expect(headers["x-ghostbridge-footprint"]).toBe("ab".repeat(32));
    expect(headers[ACCOUNT_SESSION_HEADER]).toBe(CHATBOT_ACCOUNT.sessionId);
    expect(headers[ACCOUNT_ROLE_HEADER]).toBe("chatbot");
    expect(headers[ACCOUNT_INTERNET_HEADER]).toBe("0");
  });
});
