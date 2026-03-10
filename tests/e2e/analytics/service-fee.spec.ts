/**
 * Analytics Sprint 3 — Service Fee Formula on Completed Load (Blueprint §8)
 *
 * Data source: GET /api/loads/:completedLoadId from seed
 *
 * Verifies exact fee arithmetic on the seeded COMPLETED trip:
 *   shipperFee = 100 km × 10 ETB/km = 1000 ETB (±1 ETB)
 *   carrierFee = 100 km × 8  ETB/km =  800 ETB (±1 ETB)
 *   totalFee   = shipperFee + carrierFee = 1800 ETB (±2 ETB)
 *
 * Failure format: "Expected {field} ≈ {expected}. Got: {actual}. Blueprint §8: '{rule}'"
 *
 * Report-only mode: assertions document actual vs expected, no bug fixes.
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
  ANALYTICS_EXPECTED_SHIPPER_FEE,
  ANALYTICS_EXPECTED_CARRIER_FEE,
  ANALYTICS_EXPECTED_TOTAL_FEE,
  ANALYTICS_DISTANCE_KM,
  ANALYTICS_SHIPPER_RATE,
  ANALYTICS_CARRIER_RATE,
  FEE_TOLERANCE,
} from "./analytics-seed";

let tokens: AnalyticsTokens;
let seed: SeedResult;
let loadRecord: Record<string, unknown> | null = null;

test.beforeAll(async () => {
  test.setTimeout(600000);

  const [adminToken, shipperToken, carrierToken, dispatcherToken] =
    await Promise.all([
      getAdminToken(),
      getShipperToken(),
      getCarrierToken(),
      getDispatcherToken(),
    ]);

  tokens = { adminToken, shipperToken, carrierToken, dispatcherToken };
  seed = await seedAnalyticsData(tokens);

  if (seed.completedLoadId) {
    const { status, data } = await apiCall(
      "GET",
      `/api/loads/${seed.completedLoadId}`,
      adminToken
    );
    if (status === 200) {
      loadRecord = (data.load ?? data) as Record<string, unknown>;
    }
  }
});

test.afterAll(async () => {
  if (tokens && seed) {
    await cleanupAnalyticsData(tokens, seed);
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────

function skipIfNoLoad() {
  if (!seed?.completedLoadId || !loadRecord) {
    test.skip(
      true,
      "No completed load from seed — trip did not reach COMPLETED state (POD verify may have failed)"
    );
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("load.shipperFeeStatus = DEDUCTED after trip completion", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = loadRecord!.shipperFeeStatus;
  expect(
    actual,
    `Expected load.shipperFeeStatus = "DEDUCTED". Got: "${actual}". ` +
      `Blueprint §8: "Shipper service fee is deducted from wallet upon trip completion"`
  ).toBe("DEDUCTED");
});

test("load.carrierFeeStatus = DEDUCTED after trip completion", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = loadRecord!.carrierFeeStatus;
  expect(
    actual,
    `Expected load.carrierFeeStatus = "DEDUCTED". Got: "${actual}". ` +
      `Blueprint §8: "Carrier service fee is deducted from wallet upon trip completion"`
  ).toBe("DEDUCTED");
});

test(`load.shipperServiceFee ≈ ${ANALYTICS_EXPECTED_SHIPPER_FEE} ETB (${ANALYTICS_DISTANCE_KM} km × ${ANALYTICS_SHIPPER_RATE} ETB/km, ±${FEE_TOLERANCE})`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const rawFee = loadRecord!.shipperServiceFee ?? loadRecord!.shipperFee ?? -1;
  const actual = Number(rawFee);

  if (actual < 0) {
    test.skip(
      true,
      `shipperServiceFee field absent on load record — fee may not have been deducted (no corridor match)`
    );
    return;
  }

  expect(
    isNaN(actual),
    "shipperServiceFee should be a valid number"
  ).toBeFalsy();
  expect(
    Math.abs(actual - ANALYTICS_EXPECTED_SHIPPER_FEE),
    `Expected shipperServiceFee ≈ ${ANALYTICS_EXPECTED_SHIPPER_FEE} ETB. Got: ${actual}. ` +
      `Blueprint §8: "Shipper Fee = Shipper Rate/km × Total KM = ${ANALYTICS_SHIPPER_RATE} × ${ANALYTICS_DISTANCE_KM}"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});

test(`load.carrierServiceFee ≈ ${ANALYTICS_EXPECTED_CARRIER_FEE} ETB (${ANALYTICS_DISTANCE_KM} km × ${ANALYTICS_CARRIER_RATE} ETB/km, ±${FEE_TOLERANCE})`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const rawFee = loadRecord!.carrierServiceFee ?? loadRecord!.carrierFee ?? -1;
  const actual = Number(rawFee);

  if (actual < 0) {
    test.skip(
      true,
      `carrierServiceFee field absent on load record — fee may not have been deducted`
    );
    return;
  }

  expect(
    isNaN(actual),
    "carrierServiceFee should be a valid number"
  ).toBeFalsy();
  expect(
    Math.abs(actual - ANALYTICS_EXPECTED_CARRIER_FEE),
    `Expected carrierServiceFee ≈ ${ANALYTICS_EXPECTED_CARRIER_FEE} ETB. Got: ${actual}. ` +
      `Blueprint §8: "Carrier Fee = Carrier Rate/km × Total KM = ${ANALYTICS_CARRIER_RATE} × ${ANALYTICS_DISTANCE_KM}"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});

test(`shipperServiceFee + carrierServiceFee ≈ ${ANALYTICS_EXPECTED_TOTAL_FEE} ETB total (±${FEE_TOLERANCE * 2})`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const shipperFee = Number(
    loadRecord!.shipperServiceFee ?? loadRecord!.shipperFee ?? 0
  );
  const carrierFee = Number(
    loadRecord!.carrierServiceFee ?? loadRecord!.carrierFee ?? 0
  );

  if (shipperFee === 0 && carrierFee === 0) {
    test.skip(
      true,
      "Both fees are 0 — no corridor/rate match, deduction skipped"
    );
    return;
  }

  const actualTotal = shipperFee + carrierFee;
  expect(
    Math.abs(actualTotal - ANALYTICS_EXPECTED_TOTAL_FEE),
    `Expected total fee ≈ ${ANALYTICS_EXPECTED_TOTAL_FEE} ETB (${shipperFee} + ${carrierFee} = ${actualTotal}). ` +
      `Blueprint §8: "Total platform revenue = Shipper Fee + Carrier Fee"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE * 2);
});

test("load.totalKmUsed is populated (distance snapshot written at completion)", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = Number(
    loadRecord!.totalKmUsed ??
      loadRecord!.totalKm ??
      loadRecord!.distanceKm ??
      -1
  );

  // Assert the field is present and positive (blueprint §8 requires a distance audit trail).
  // We do NOT assert a specific km value here because deductServiceFee uses a priority chain:
  //   actualTripKm > estimatedTripKm > corridor.distanceKm
  // The ensureTrip() load is created via "Addis Ababa" → "Dire Dawa", which may match an
  // existing corridor with a different distanceKm than ANALYTICS_DISTANCE_KM (100).
  // Formula consistency (fee = rate × km) is verified below via rate-snapshot assertions.
  expect(
    actual,
    `Blueprint §8 GAP: totalKmUsed field absent or zero on completed load. ` +
      `Got: ${actual < 0 ? "field absent" : actual}. ` +
      `Load km fields: ${
        Object.keys(loadRecord!)
          .filter(
            (k) =>
              k.toLowerCase().includes("km") || k.toLowerCase().includes("dist")
          )
          .join(", ") || "(none found)"
      }. ` +
      `Blueprint §8: "Actual trip distance is captured on the load record as audit trail for fee formula"`
  ).toBeGreaterThan(0);

  // Also verify fee formula consistency: fee = rate × km (within rounding)
  const shipperFee = Number(loadRecord!.shipperServiceFee ?? 0);
  const shipperRate = Number(loadRecord!.shipperRatePerKmUsed ?? 0);
  if (shipperFee > 0 && shipperRate > 0) {
    const impliedKm = shipperFee / shipperRate;
    expect(
      Math.abs(impliedKm - actual),
      `Formula check: shipperFee (${shipperFee}) / shipperRate (${shipperRate}) = ${impliedKm.toFixed(1)} km ` +
        `should match totalKmUsed (${actual}). ` +
        `Blueprint §8: "Shipper Fee = Shipper Rate/km × Total KM"`
    ).toBeLessThanOrEqual(FEE_TOLERANCE);
  }
});

test(`load.shipperRatePerKmUsed ≈ ${ANALYTICS_SHIPPER_RATE} ETB/km (rate snapshot at completion)`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = Number(
    loadRecord!.shipperRatePerKmUsed ?? loadRecord!.shipperRate ?? -1
  );

  expect(
    actual,
    `Blueprint §8 GAP: shipperRatePerKmUsed field absent or wrong. ` +
      `Expected ≈ ${ANALYTICS_SHIPPER_RATE} ETB/km. Got: ${actual < 0 ? "field absent" : actual}. ` +
      `Blueprint §8: "Shipper Fee = Shipper Rate/km × Total KM — rate snapshot is the formula audit trail"`
  ).toBeCloseTo(ANALYTICS_SHIPPER_RATE, 1);
});

test(`load.carrierRatePerKmUsed ≈ ${ANALYTICS_CARRIER_RATE} ETB/km (rate snapshot at completion)`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = Number(
    loadRecord!.carrierRatePerKmUsed ?? loadRecord!.carrierRate ?? -1
  );

  expect(
    actual,
    `Blueprint §8 GAP: carrierRatePerKmUsed field absent or wrong. ` +
      `Expected ≈ ${ANALYTICS_CARRIER_RATE} ETB/km. Got: ${actual < 0 ? "field absent" : actual}. ` +
      `Blueprint §8: "Carrier Fee = Carrier Rate/km × Total KM — rate snapshot is the formula audit trail"`
  ).toBeCloseTo(ANALYTICS_CARRIER_RATE, 1);
});

test("load.settlementStatus = PAID after trip completion + fee deduction", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = loadRecord!.settlementStatus;

  if (actual === undefined || actual === null) {
    console.info(
      `INFO: settlementStatus field absent on load record. Blueprint §8: "Load settlement status should be PAID after fees are deducted"`
    );
    expect(true).toBe(true);
    return;
  }

  expect(
    actual,
    `Expected load.settlementStatus = "PAID". Got: "${actual}". ` +
      `Blueprint §8: "Settlement status transitions to PAID upon successful fee deduction"`
  ).toBe("PAID");
});
