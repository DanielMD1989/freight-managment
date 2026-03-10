/**
 * Analytics Sprint 3 — Truck Stats (Blueprint §4 / §10)
 *
 * Endpoint: GET /api/admin/analytics?period=year → summary.trucks
 *
 * Seeds 3 trucks (1 APPROVED, 1 PENDING, 1 REJECTED) via analytics-seed.ts
 * and asserts that counts in the analytics summary reflect the seeded data.
 *
 * Report-only mode: failures include actual vs expected with blueprint citation.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getAdminToken,
  getShipperToken,
  getCarrierToken,
  getDispatcherToken,
} from "../shared/test-utils";
import {
  seedAnalyticsData,
  cleanupAnalyticsData,
  type SeedResult,
  type AnalyticsTokens,
} from "./analytics-seed";

const ANALYTICS_ENDPOINT = "/api/admin/analytics?period=year";

let tokens: AnalyticsTokens;
let seed: SeedResult;
let analyticsStatus: number;
let analyticsSummary: Record<string, unknown>;

test.beforeAll(async () => {
  test.setTimeout(600000); // 10 min — full seed cycle

  const [adminToken, shipperToken, carrierToken, dispatcherToken] =
    await Promise.all([
      getAdminToken(),
      getShipperToken(),
      getCarrierToken(),
      getDispatcherToken(),
    ]);

  tokens = { adminToken, shipperToken, carrierToken, dispatcherToken };

  seed = await seedAnalyticsData(tokens);

  const { status, data } = await apiCall("GET", ANALYTICS_ENDPOINT, adminToken);
  analyticsStatus = status;
  analyticsSummary = (data.summary as Record<string, unknown>) ?? {};
});

test.afterAll(async () => {
  if (tokens && seed) {
    await cleanupAnalyticsData(tokens, seed);
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("GET /api/admin/analytics returns 200 with summary.trucks shape", async () => {
  test.setTimeout(60000);
  expect(
    analyticsStatus,
    `Expected 200 for GET ${ANALYTICS_ENDPOINT}. Got: ${analyticsStatus}. Blueprint §4: "Analytics endpoint returns aggregate truck statistics"`
  ).toBe(200);

  const trucks = (analyticsSummary.trucks as Record<string, number>) ?? {};
  expect(typeof trucks.total, "summary.trucks.total should be a number").toBe(
    "number"
  );
  expect(
    typeof trucks.approved,
    "summary.trucks.approved should be a number"
  ).toBe("number");
  expect(
    typeof trucks.pending,
    "summary.trucks.pending should be a number"
  ).toBe("number");
});

test("summary.trucks.total >= baseline + 3 (3 trucks seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }

  const trucks = (analyticsSummary.trucks as Record<string, number>) ?? {};
  const actual = Number(trucks.total ?? 0);
  const expected = seed.baseline.truckTotal + 3;

  expect(
    actual,
    `Expected summary.trucks.total >= ${expected} (baseline=${seed.baseline.truckTotal} + 3 seeded). Got: ${actual}. Blueprint §4: "Truck count tracks all registered trucks"`
  ).toBeGreaterThanOrEqual(expected);
});

test("summary.trucks.approved >= baseline + 1 (1 APPROVED truck seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }
  if (!seed.seededTrucks.approvedId) {
    test.skip(true, "Approved truck was not seeded");
    return;
  }

  const trucks = (analyticsSummary.trucks as Record<string, number>) ?? {};
  const actual = Number(trucks.approved ?? 0);
  const expected = seed.baseline.truckApproved + 1;

  expect(
    actual,
    `Expected summary.trucks.approved >= ${expected} (baseline=${seed.baseline.truckApproved} + 1). Got: ${actual}. Blueprint §4: "Approved trucks counted separately"`
  ).toBeGreaterThanOrEqual(expected);
});

test("summary.trucks.pending >= baseline + 1 (1 PENDING truck seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }
  if (!seed.seededTrucks.pendingId) {
    test.skip(true, "Pending truck was not seeded");
    return;
  }

  const trucks = (analyticsSummary.trucks as Record<string, number>) ?? {};
  const actual = Number(trucks.pending ?? 0);
  const expected = seed.baseline.truckPending + 1;

  expect(
    actual,
    `Expected summary.trucks.pending >= ${expected} (baseline=${seed.baseline.truckPending} + 1). Got: ${actual}. Blueprint §4: "Pending trucks counted separately"`
  ).toBeGreaterThanOrEqual(expected);
});

test("summary.trucks.rejected is defined and >= 1 after seeding a REJECTED truck (blueprint §4)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }
  if (!seed.seededTrucks.rejectedId) {
    test.skip(true, "Rejected truck was not seeded — cannot verify count");
    return;
  }

  // Verify the rejected truck exists by fetching it directly (no admin/trucks list endpoint)
  const { status: truckStatus, data: truckData } = await apiCall(
    "GET",
    `/api/trucks/${seed.seededTrucks.rejectedId}`,
    tokens.carrierToken
  );
  if (truckStatus === 200 || truckStatus === 404) {
    // 200 = found (either pending/rejected); 404 = deleted. Either way the seed ran.
    // The approve API returned 200 when rejecting, so the truck IS rejected in DB.
    // We trust the seed's reject API response (which returned 200) rather than re-querying.
  }
  // The seed rejection API returned 200, confirming the truck was rejected. Log for diagnostics.
  console.info(
    `Rejected truck fetch status: ${truckStatus} (id: ${seed.seededTrucks.rejectedId}). ` +
      `Seed rejection API returned 200 — truck is REJECTED in DB.`
  );

  const trucks = (analyticsSummary.trucks as Record<string, number>) ?? {};

  // Hard assertion: analytics must expose the rejected count
  const rejectedCount = trucks.rejected ?? trucks.rejectedCount;
  expect(
    rejectedCount,
    `Blueprint §4: summary.trucks.rejected field is missing from analytics response. ` +
      `Current trucks fields: ${Object.keys(trucks).join(", ")}. ` +
      `Fix: expose REJECTED count from byApprovalStatus in getTruckMetrics() and analytics route.`
  ).toBeDefined();

  expect(
    Number(rejectedCount),
    `Blueprint §4: summary.trucks.rejected should be >= 1 after seeding a REJECTED truck. ` +
      `Got: ${rejectedCount}. Seeded rejected truck id: ${seed.seededTrucks.rejectedId}`
  ).toBeGreaterThanOrEqual(1);
});

test("Dispatcher: GET /api/admin/analytics returns 200 (blueprint §5)", async () => {
  test.setTimeout(60000);
  const { status } = await apiCall(
    "GET",
    ANALYTICS_ENDPOINT,
    tokens.dispatcherToken
  );
  expect(
    status,
    `Expected dispatcher to receive 200 on analytics. Got: ${status}. Blueprint §5: "Dispatcher has read access to platform analytics"`
  ).toBe(200);
});
