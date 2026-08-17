import { describe, expect, it } from "vitest";
import {
  PLUGIN_METHOD_BY_PLUGIN,
  PLUGIN_METHOD_BY_SUBID,
} from "@/grpc/gen/plugin-methods-index";

/**
 * Kimi's OpenCode commit retargeted ProviderSelect at 3tched-router OSCAL
 * subids. The generated plugin-methods registry still listed zeroclaw, so
 * callSubid threw. This is the contract the sealed-blob regen must satisfy.
 */
describe("tched_router plugin methods", () => {
  it("registers the 3tched-router OSCAL subids ProviderSelect calls", () => {
    expect(PLUGIN_METHOD_BY_SUBID.get("obs.service.3tched-router.providers.list@v1")?.plugin).toBe(
      "tched_router",
    );
    expect(PLUGIN_METHOD_BY_SUBID.get("obs.service.3tched-router.router.get@v1")?.plugin).toBe(
      "tched_router",
    );
    expect(PLUGIN_METHOD_BY_SUBID.get("mut.service.3tched-router.provider.set@v1")?.plugin).toBe(
      "tched_router",
    );
  });

  it("does not keep the retired zeroclaw plugin id or subids", () => {
    expect(PLUGIN_METHOD_BY_PLUGIN.has("zeroclaw")).toBe(false);
    expect(PLUGIN_METHOD_BY_SUBID.has("obs.service.zeroclaw.providers.list@v1")).toBe(false);
    expect(PLUGIN_METHOD_BY_SUBID.has("mut.service.zeroclaw.provider.set@v1")).toBe(false);
  });

  it("keeps the OVS routing model assignment on the router plugin", () => {
    expect(
      PLUGIN_METHOD_BY_SUBID.get(
        "mut.service.3tched-router.model-assignments.ovs-routing.set@v1",
      )?.method,
    ).toBe("setOvsRoutingModel");
  });
});
