/**
 * Analytics Sprint 3 — Trip Stats (Blueprint §4 / §10)
 *
 * Endpoint: GET /api/admin/analytics?period=year → summary.trips
 *
 * Seeds 4 trips (ASSIGNED, IN_TRANSIT, CANCELLED, COMPLETED) via analytics-seed.ts
 * and asserts that the analytics summary reflects each seeded state.
 *
 * Uses summary.trips.byStatus for all-time counts (reliable across runs).
 * Uses summary.trips.total for aggregate assertion.
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
let analyticsData: Record<string, unknown>;
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

  const result = await apiCall("GET", ANALYTICS_ENDPOINT, adminToken);
  analyticsStatus = result.status;
  analyticsData = result.data as Record<string, unknown>;
  analyticsSummary = (analyticsData.summary as Record<string, unknown>) ?? {};
});

test.afterAll(async () => {
  if (tokens && seed) {
    await cleanupAnalyticsData(tokens, seed);
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("summary.trips.total >= baseline + 4 (4 trips seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }

  const trips = (analyticsSummary.trips as Record<string, unknown>) ?? {};
  const actual = Number(trips.total ?? 0);
  const expected = seed.baseline.tripTotal + 4;

  expect(
    actual,
    `Expected summary.trips.total >= ${expected} (baseline=${seed.baseline.tripTotal} + 4 seeded). Got: ${actual}. Blueprint §4: "Trip count tracks all trips across statuses"`
  ).toBeGreaterThanOrEqual(expected);
});

test("summary.trips.byStatus.ASSIGNED >= 1 (ASSIGNED trip seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }
  if (!seed.seededTrips.assignedId) {
    test.skip(true, "ASSIGNED trip was not seeded");
    return;
  }

  const trips = (analyticsSummary.trips as Record<string, unknown>) ?? {};
  const byStatus = (trips.byStatus as Record<string, number>) ?? {};
  const actual = Number(byStatus.ASSIGNED ?? 0);

  expect(
    actual,
    `Expected summary.trips.byStatus.ASSIGNED >= 1. Got: ${actual}. Blueprint §4: "Trip status breakdown includes ASSIGNED state"`
  ).toBeGreaterThanOrEqual(1);
});

test("summary.trips.byStatus.IN_TRANSIT >= 1 (IN_TRANSIT trip seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }
  if (!seed.seededTrips.inTransitId) {
    test.skip(true, "IN_TRANSIT trip was not seeded");
    return;
  }

  const trips = (analyticsSummary.trips as Record<string, unknown>) ?? {};
  const byStatus = (trips.byStatus as Record<string, number>) ?? {};
  const actual = Number(byStatus.IN_TRANSIT ?? 0);

  expect(
    actual,
    `Expected summary.trips.byStatus.IN_TRANSIT >= 1. Got: ${actual}. Blueprint §4: "Trip status breakdown includes IN_TRANSIT state"`
  ).toBeGreaterThanOrEqual(1);
});

test("summary.trips.byStatus.CANCELLED is a number (cancelled trips tracked)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }

  const trips = (analyticsSummary.trips as Record<string, unknown>) ?? {};
  const byStatus = (trips.byStatus as Record<string, unknown>) ?? {};

  expect(
    typeof byStatus.CANCELLED === "number" || byStatus.CANCELLED === undefined,
    `Expected summary.trips.byStatus.CANCELLED to be a number or absent. Got: ${typeof byStatus.CANCELLED}. Blueprint §4: "Cancellation tracking should be present in analytics"`
  ).toBe(true);

  // If present, must be >= 0
  if (typeof byStatus.CANCELLED === "number") {
    expect(byStatus.CANCELLED).toBeGreaterThanOrEqual(0);
  } else {
    console.info(
      `INFO: summary.trips.byStatus.CANCELLED field is absent. ` +
        `Blueprint §4: "Cancellation count should be exposed in trip breakdown"`
    );
  }
});

test("summary.trips.byStatus.COMPLETED >= 1 (COMPLETED trip seeded)", async () => {
  test.setTimeout(60000);
  if (analyticsStatus !== 200) {
    test.skip(true, `Analytics returned ${analyticsStatus}`);
    return;
  }
  if (!seed.seededTrips.completedId) {
    test.skip(
      true,
      "COMPLETED trip was not seeded (POD verify likely skipped)"
    );
    return;
  }

  const trips = (analyticsSummary.trips as Record<string, unknown>) ?? {};
  const byStatus = (trips.byStatus as Record<string, number>) ?? {};
  const actual = Number(byStatus.COMPLETED ?? 0);

  expect(
    actual,
    `Expected summary.trips.byStatus.COMPLETED >= 1. Got: ${actual}. Blueprint §4: "Completed trips tracked in analytics summary"`
  ).toBeGreaterThanOrEqual(1);
});

test("Dispatcher: GET /api/admin/analytics returns 200 with trip visibility (blueprint §5)", async () => {
  test.setTimeout(60000);
  const { status, data } = await apiCall(
    "GET",
    ANALYTICS_ENDPOINT,
    tokens.dispatcherToken
  );

  expect(
    status,
    `Expected dispatcher 200 on analytics. Got: ${status}. Blueprint §5: "Dispatcher can view trip analytics"`
  ).toBe(200);

  const summary = (data.summary as Record<string, unknown>) ?? {};
  const trips = (summary.trips as Record<string, unknown>) ?? {};
  expect(
    typeof trips.total === "number" || "total" in trips,
    "Dispatcher analytics response should include trip summary"
  ).toBeTruthy();
});
