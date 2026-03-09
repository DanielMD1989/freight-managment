/**
 * Shared utilities for the blueprint E2E suite.
 *
 * Re-exports everything from the existing shipper test-utils
 * (token cache, apiCall, getToken, ensureLoad, ensureTrip, etc.)
 * and adds role-specific shorthand token getters.
 */

export * from "../../../e2e/shipper/test-utils";

export const DISPATCHER_PASSWORD = "password";

// Inline import to avoid circular — getToken is re-exported above
import { getToken } from "../../../e2e/shipper/test-utils";

export function getDispatcherToken() {
  return getToken("dispatcher@test.com", DISPATCHER_PASSWORD);
}

export function getCarrierToken() {
  return getToken("carrier@test.com");
}

export function getShipperToken() {
  return getToken("shipper@test.com");
}

export function getAdminToken() {
  return getToken("admin@test.com");
}
