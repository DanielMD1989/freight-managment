/**
 * Blueprint §8 — Wallet Threshold / Marketplace Gate
 *
 * Blueprint §8: "If below the required minimum, the user CANNOT view,
 * match, request, or be requested. All marketplace activity is blocked."
 *
 * Tests 5 scenarios covering the minimumBalance enforcement gate.
 * The gate is implemented in GET /api/truck-postings (returns 402 when
 * authenticated SHIPPER or CARRIER has balance < minimumBalance).
 *
 * Admin setup: PATCH /api/admin/users/:id/wallet { minimumBalance } sets
 * the threshold on the org's financial account.
 *
 * afterAll: Resets minimumBalance to 0 for both test orgs.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getAdminToken,
  getShipperToken,
  getCarrierToken,
} from "../shared/test-utils";

const TRUCK_POSTINGS = "/api/truck-postings";
const ABOVE_BALANCE = 9_999_999; // 9.9M ETB — far above any test wallet

let adminToken: string;
let shipperToken: string;
let carrierToken: string;
let shipperUserId: string | null = null;
let carrierUserId: string | null = null;

test.beforeAll(async () => {
  test.setTimeout(60000);

  [adminToken, shipperToken, carrierToken] = await Promise.all([
    getAdminToken(),
    getShipperToken(),
    getCarrierToken(),
  ]);

  // Resolve user IDs needed for admin wallet PATCH
  const [shipperMe, carrierMe] = await Promise.all([
    apiCall("GET", "/api/auth/me", shipperToken),
    apiCall("GET", "/api/auth/me", carrierToken),
  ]);
  shipperUserId = shipperMe.data.user?.id ?? shipperMe.data.id ?? null;
  carrierUserId = carrierMe.data.user?.id ?? carrierMe.data.id ?? null;
});

test.afterAll(async () => {
  // Reset minimumBalance to 0 for both users — prevent pollution of other tests
  const resets = [];
  if (shipperUserId) {
    resets.push(
      apiCall("PATCH", `/api/admin/users/${shipperUserId}/wallet`, adminToken, {
        minimumBalance: 0,
      }).catch(() => {})
    );
  }
  if (carrierUserId) {
    resets.push(
      apiCall("PATCH", `/api/admin/users/${carrierUserId}/wallet`, adminToken, {
        minimumBalance: 0,
      }).catch(() => {})
    );
  }
  await Promise.allSettled(resets);
});

// ── T1: Admin sets carrier minimumBalance above balance ──────────────────────

test("T1: Admin PATCH /api/admin/users/:id/wallet sets carrier minimumBalance", async () => {
  test.setTimeout(30000);

  if (!carrierUserId) {
    test.skip(true, "Could not resolve carrier user ID from /api/auth/me");
    return;
  }

  const { status, data } = await apiCall(
    "PATCH",
    `/api/admin/users/${carrierUserId}/wallet`,
    adminToken,
    { minimumBalance: ABOVE_BALANCE }
  );

  expect(
    status,
    `Expected 200 from PATCH admin wallet. Got: ${status} — ${JSON.stringify(data)}. ` +
      `Blueprint §8: "Admin must be able to configure per-org minimum balance threshold"`
  ).toBe(200);
});

// ── T2: Carrier is blocked from marketplace when below minimum ───────────────

test("T2: Carrier GET /api/truck-postings returns 402 when balance < minimumBalance", async () => {
  test.setTimeout(30000);

  if (!carrierUserId) {
    test.skip(true, "T1 skipped — no carrier user ID");
    return;
  }

  const { status, data } = await apiCall("GET", TRUCK_POSTINGS, carrierToken);

  expect(
    status,
    `Expected 402 from GET ${TRUCK_POSTINGS} when carrier balance < minimumBalance. ` +
      `Got: ${status} — ${JSON.stringify(data)}. ` +
      `Blueprint §8: "All marketplace activity is blocked when balance is below minimum"`
  ).toBe(402);

  const errMsg = (data as Record<string, unknown>)?.error as string | undefined;
  if (errMsg) {
    expect(
      errMsg.toLowerCase(),
      `Expected 402 error message to mention wallet/balance. Got: "${errMsg}"`
    ).toMatch(/balance|wallet|minimum/i);
  }
});

// ── T3: Admin resets carrier minimumBalance to 0 (unblocked) ────────────────

test("T3: After resetting carrier minimumBalance to 0, GET /api/truck-postings returns 200", async () => {
  test.setTimeout(30000);

  if (!carrierUserId) {
    test.skip(true, "T1 skipped — no carrier user ID");
    return;
  }

  // Reset
  const { status: resetStatus } = await apiCall(
    "PATCH",
    `/api/admin/users/${carrierUserId}/wallet`,
    adminToken,
    { minimumBalance: 0 }
  );
  expect(
    resetStatus,
    `Expected 200 from PATCH admin wallet (reset to 0). Got: ${resetStatus}`
  ).toBe(200);

  // Now carrier should be unblocked
  const { status } = await apiCall("GET", TRUCK_POSTINGS, carrierToken);
  expect(
    status,
    `Expected 200 from GET ${TRUCK_POSTINGS} after minimumBalance reset to 0. ` +
      `Got: ${status}. Blueprint §8: "Marketplace access restored when balance >= minimum"`
  ).toBe(200);
});

// ── T4: Shipper is also gated when their minimumBalance is high ──────────────

test("T4: Shipper GET /api/truck-postings returns 402 when shipper balance < minimumBalance", async () => {
  test.setTimeout(30000);

  if (!shipperUserId) {
    test.skip(true, "Could not resolve shipper user ID");
    return;
  }

  // Set shipper minimumBalance above balance
  const { status: setStatus } = await apiCall(
    "PATCH",
    `/api/admin/users/${shipperUserId}/wallet`,
    adminToken,
    { minimumBalance: ABOVE_BALANCE }
  );
  if (setStatus !== 200) {
    test.skip(true, `Failed to set shipper minimumBalance: ${setStatus}`);
    return;
  }

  const { status } = await apiCall("GET", TRUCK_POSTINGS, shipperToken);
  expect(
    status,
    `Expected 402 from GET ${TRUCK_POSTINGS} when shipper balance < minimumBalance. ` +
      `Got: ${status}. Blueprint §8: "Carrier AND shipper marketplace access is gated by minimumBalance"`
  ).toBe(402);

  // Cleanup shipper
  await apiCall(
    "PATCH",
    `/api/admin/users/${shipperUserId}/wallet`,
    adminToken,
    { minimumBalance: 0 }
  ).catch(() => {});
});

// ── T5: Unauth/admin requests are not gated ──────────────────────────────────

test("T5: Admin GET /api/truck-postings is not blocked by minimumBalance (no org wallet)", async () => {
  test.setTimeout(30000);

  // Admin has no org wallet — the gate should not fire for them
  const { status } = await apiCall("GET", TRUCK_POSTINGS, adminToken);
  expect(
    [200, 401, 403],
    `Expected admin to receive 200 (or 401/403 if admin blocked from carrier endpoint), not 402. ` +
      `Got: ${status}. Blueprint §8: "Admin is not subject to wallet minimumBalance gate"`
  ).toContain(status);

  expect(
    status,
    `Admin should NOT receive 402 wallet gate — admin has no org wallet. Got: ${status}`
  ).not.toBe(402);
});
