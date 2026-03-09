/**
 * Shared utilities for the blueprint E2E suite.
 *
 * Re-exports everything from the existing shipper test-utils
 * (token cache, apiCall, getToken, ensureLoad, ensureTrip, etc.)
 * and adds role-specific shorthand token getters.
 */

export * from "../../../e2e/shipper/test-utils";
export { invalidateTokenCache } from "../../../e2e/shared/token-cache";

export const DISPATCHER_PASSWORD = "password";

// Inline imports to avoid circular — these are re-exported above
import { getToken, apiCall } from "../../../e2e/shipper/test-utils";
import { invalidateTokenCache as _invalidateTokenCache } from "../../../e2e/shared/token-cache";

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

/**
 * Re-activate all four test users via the admin API and clear their token cache.
 *
 * Call this in `afterAll` for any spec that runs destructive admin actions
 * (revoke, suspend) on shared test accounts. Prevents cascading failures in
 * subsequent spec files.
 */
export async function restoreTestUsers(): Promise<void> {
  const adminToken = await getAdminToken();

  const testUsers = [
    { email: "shipper@test.com", role: "SHIPPER" },
    { email: "carrier@test.com", role: "CARRIER" },
    { email: "dispatcher@test.com", role: "DISPATCHER" },
  ];

  for (const { email } of testUsers) {
    // Find user by listing (admin users endpoint supports email filter)
    const { data } = await apiCall(
      "GET",
      `/api/admin/users?email=${encodeURIComponent(email)}&limit=5`,
      adminToken
    );
    const users: Array<{ id: string; email: string }> =
      data.users ?? data ?? [];
    const user = users.find((u) => u.email === email);
    if (user) {
      await apiCall("PATCH", `/api/admin/users/${user.id}`, adminToken, {
        status: "ACTIVE",
      });
    }
    _invalidateTokenCache(email);
  }
}
