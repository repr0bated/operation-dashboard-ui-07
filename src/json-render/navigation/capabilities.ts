/**
 * Capability gate for navigation and page specs.
 *
 * Today every capability resolves to `true` — this is a stub that future
 * identity/role code will hook into. Nav manifest entries with
 * `requiredCapabilities` are filtered through `hasCapability`.
 */

export type Capability = string;

export interface CapabilitySet {
  has(cap: Capability): boolean;
}

export const ALLOW_ALL: CapabilitySet = {
  has: () => true,
};

export function hasCapability(caps: CapabilitySet, cap: Capability): boolean {
  return caps.has(cap);
}

export function hasAll(caps: CapabilitySet, required?: Capability[]): boolean {
  if (!required || required.length === 0) return true;
  return required.every((c) => caps.has(c));
}
