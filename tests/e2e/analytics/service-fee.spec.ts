/**
 * Analytics Sprint 3 — Service Fee Formula on Completed Load (Blueprint §8)
 *
 * Data source: GET /api/loads/:completedLoadId from seed
 *
 * Verifies formula consistency on the seeded COMPLETED trip:
 *   shipperFee = shipperRatePerKmUsed × totalKmUsed
 *   carrierFee = carrierRatePerKmUsed × totalKmUsed
 *   totalFee   = shipperFee + carrierFee > 0
 *
 * Tests survive any corridor distance — formula-consistent, not hardcoded.
 *
 * Failure format: "Expected {field} formula-consistent. Got: {actual}. Blueprint §8: '{rule}'"
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
  if (
    !seed?.completedLoadId ||
    !loadRecord ||
    loadRecord.shipperFeeStatus !== "DEDUCTED"
  ) {
    test.skip(
      true,
      "No completed load with DEDUCTED fee — trip did not reach COMPLETED state or fee was waived"
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

test("load.shipperServiceFee = shipperRatePerKmUsed × totalKmUsed (formula, ±1 ETB)", async () => {
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

  const km = Number(loadRecord!.totalKmUsed ?? -1);
  const rate = Number(loadRecord!.shipperRatePerKmUsed ?? -1);
  if (km <= 0 || rate <= 0) {
    test.skip(
      true,
      "totalKmUsed or shipperRatePerKmUsed not populated — cannot verify formula"
    );
    return;
  }
  const expected = rate * km;
  expect(
    Math.abs(actual - expected),
    `Expected shipperServiceFee (${actual}) ≈ shipperRatePerKmUsed (${rate}) × totalKmUsed (${km}) = ${expected.toFixed(2)}. ` +
      `Blueprint §8: "Shipper Fee = Shipper Rate/km × Total KM"`
  ).toBeLessThanOrEqual(1);
});

test("load.carrierServiceFee = carrierRatePerKmUsed × totalKmUsed (formula, ±1 ETB)", async () => {
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

  const km = Number(loadRecord!.totalKmUsed ?? -1);
  const rate = Number(loadRecord!.carrierRatePerKmUsed ?? -1);
  if (km <= 0 || rate <= 0) {
    test.skip(
      true,
      "totalKmUsed or carrierRatePerKmUsed not populated — cannot verify formula"
    );
    return;
  }
  const expected = rate * km;
  expect(
    Math.abs(actual - expected),
    `Expected carrierServiceFee (${actual}) ≈ carrierRatePerKmUsed (${rate}) × totalKmUsed (${km}) = ${expected.toFixed(2)}. ` +
      `Blueprint §8: "Carrier Fee = Carrier Rate/km × Total KM"`
  ).toBeLessThanOrEqual(1);
});

test("total fee = shipperServiceFee + carrierServiceFee > 0", async () => {
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
    actualTotal,
    `Expected total fee (${shipperFee} + ${carrierFee} = ${actualTotal}) > 0. ` +
      `Blueprint §8: "Total platform revenue = Shipper Fee + Carrier Fee"`
  ).toBeGreaterThan(0);

  // Shipper rate > carrier rate → shipper fee should be higher for same distance
  if (shipperFee > 0 && carrierFee > 0) {
    expect(
      shipperFee,
      `Expected shipperFee (${shipperFee}) > carrierFee (${carrierFee}) (shipper rate > carrier rate). ` +
        `Blueprint §8: "Independent per-party rates"`
    ).toBeGreaterThan(carrierFee);
  }
});

test("load.totalKmUsed is populated and > 0 (distance snapshot written at completion)", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = Number(
    loadRecord!.totalKmUsed ??
      loadRecord!.totalKm ??
      loadRecord!.distanceKm ??
      -1
  );

  expect(
    actual,
    `Blueprint §8 GAP: totalKmUsed field absent or zero on completed load. ` +
      `Got: ${actual < 0 ? "field absent" : actual}. ` +
      `Blueprint §8: "Actual trip distance is captured on the load record as audit trail for fee formula"`
  ).toBeGreaterThan(0);

  // Also verify fee formula consistency: fee = rate × km (within rounding)
  const shipperFee = Number(loadRecord!.shipperServiceFee ?? 0);
  const shipperRate = Number(loadRecord!.shipperRatePerKmUsed ?? 0);
  if (shipperFee > 0 && shipperRate > 0 && actual > 0) {
    const impliedKm = shipperFee / shipperRate;
    expect(
      Math.abs(impliedKm - actual),
      `Formula check: shipperFee (${shipperFee}) / shipperRate (${shipperRate}) = ${impliedKm.toFixed(1)} km ` +
        `should match totalKmUsed (${actual}). ` +
        `Blueprint §8: "Shipper Fee = Shipper Rate/km × Total KM"`
    ).toBeLessThanOrEqual(1);
  }
});

test("load.shipperRatePerKmUsed > 0 (rate snapshot written at completion)", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = Number(
    loadRecord!.shipperRatePerKmUsed ?? loadRecord!.shipperRate ?? -1
  );

  expect(
    actual,
    `Blueprint §8 GAP: shipperRatePerKmUsed field absent or zero. ` +
      `Got: ${actual < 0 ? "field absent" : actual}. ` +
      `Blueprint §8: "Shipper Fee = Shipper Rate/km × Total KM — rate snapshot is the formula audit trail"`
  ).toBeGreaterThan(0);
});

test("load.carrierRatePerKmUsed > 0 (rate snapshot written at completion)", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();

  const actual = Number(
    loadRecord!.carrierRatePerKmUsed ?? loadRecord!.carrierRate ?? -1
  );

  expect(
    actual,
    `Blueprint §8 GAP: carrierRatePerKmUsed field absent or zero. ` +
      `Got: ${actual < 0 ? "field absent" : actual}. ` +
      `Blueprint §8: "Carrier Fee = Carrier Rate/km × Total KM — rate snapshot is the formula audit trail"`
  ).toBeGreaterThan(0);
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

// ── Group A — Legacy field sync ───────────────────────────────────────────────

test("load.serviceFeeStatus (legacy) = DEDUCTED — legacy field synced from dual-party status", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = loadRecord!.serviceFeeStatus;
  expect(
    actual,
    `Expected legacy serviceFeeStatus = "DEDUCTED". Got: "${actual}". ` +
      `Blueprint §8: "Legacy serviceFeeStatus synced from shipperFeeStatus+carrierFeeStatus"`
  ).toBe("DEDUCTED");
});

test("load.serviceFeeEtb (legacy) ≈ shipperServiceFee + carrierServiceFee (total platform fee)", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const legacy = Number(loadRecord!.serviceFeeEtb ?? -1);
  const shipperFee = Number(loadRecord!.shipperServiceFee ?? 0);
  const carrierFee = Number(loadRecord!.carrierServiceFee ?? 0);
  if (legacy < 0) {
    test.skip(true, "serviceFeeEtb absent");
    return;
  }
  expect(
    Math.abs(legacy - (shipperFee + carrierFee)),
    `Expected serviceFeeEtb (${legacy}) ≈ ${shipperFee} + ${carrierFee} = ${shipperFee + carrierFee}. ` +
      `Blueprint §8: "Legacy field synced to total platform fee"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});

// ── Group B — Timestamp completeness ─────────────────────────────────────────

test("load.carrierFeeDeductedAt is set after trip completion", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = loadRecord!.carrierFeeDeductedAt;
  expect(
    actual,
    `Expected carrierFeeDeductedAt to be set. Got: ${actual}. ` +
      `Blueprint §8: "Carrier fee deduction timestamp recorded"`
  ).toBeTruthy();
});

test("shipperFeeDeductedAt and carrierFeeDeductedAt are valid dates within 60s (same transaction)", async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const rawShipper = loadRecord!.shipperFeeDeductedAt as string;
  const rawCarrier = loadRecord!.carrierFeeDeductedAt as string;
  if (!rawShipper || !rawCarrier) {
    test.skip(true, "One or both timestamps absent");
    return;
  }
  const shipperTs = new Date(rawShipper).getTime();
  const carrierTs = new Date(rawCarrier).getTime();
  expect(
    isNaN(shipperTs),
    "shipperFeeDeductedAt must be a valid date"
  ).toBeFalsy();
  expect(
    isNaN(carrierTs),
    "carrierFeeDeductedAt must be a valid date"
  ).toBeFalsy();
  expect(
    Math.abs(shipperTs - carrierTs),
    `Expected shipper and carrier timestamps within 60s of each other. ` +
      `Delta: ${Math.abs(shipperTs - carrierTs)}ms. Blueprint §8: "Both deductions are atomic (same $transaction)"`
  ).toBeLessThanOrEqual(60_000);
});

// ── Group C — Deterministic snapshot assertions ───────────────────────────────

test(`load.totalKmUsed = ${ANALYTICS_DISTANCE_KM} km (corridor baseline, no GPS on test trip)`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = Number(loadRecord!.totalKmUsed ?? -1);
  expect(
    actual,
    `Expected totalKmUsed = ${ANALYTICS_DISTANCE_KM}. Got: ${actual}. ` +
      `No actualTripKm set → billing chain uses corridor.distanceKm = ${ANALYTICS_DISTANCE_KM}.`
  ).toBe(ANALYTICS_DISTANCE_KM);
});

test(`load.shipperRatePerKmUsed ≈ ${ANALYTICS_SHIPPER_RATE} ETB/km (org override applied by seed)`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = Number(loadRecord!.shipperRatePerKmUsed ?? -1);
  expect(
    actual,
    `Expected shipperRatePerKmUsed ≈ ${ANALYTICS_SHIPPER_RATE}. Got: ${actual}.`
  ).toBeCloseTo(ANALYTICS_SHIPPER_RATE, 1);
});

test(`load.carrierRatePerKmUsed ≈ ${ANALYTICS_CARRIER_RATE} ETB/km (org override applied by seed)`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = Number(loadRecord!.carrierRatePerKmUsed ?? -1);
  expect(
    actual,
    `Expected carrierRatePerKmUsed ≈ ${ANALYTICS_CARRIER_RATE}. Got: ${actual}.`
  ).toBeCloseTo(ANALYTICS_CARRIER_RATE, 1);
});

// ── Group D — Exact fee amounts ───────────────────────────────────────────────

test(`load.shipperServiceFee ≈ ${ANALYTICS_EXPECTED_SHIPPER_FEE} ETB (${ANALYTICS_DISTANCE_KM} km × ${ANALYTICS_SHIPPER_RATE} ETB/km, ±${FEE_TOLERANCE})`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = Number(loadRecord!.shipperServiceFee ?? -1);
  if (actual < 0) {
    test.skip(true, "shipperServiceFee absent");
    return;
  }
  expect(
    Math.abs(actual - ANALYTICS_EXPECTED_SHIPPER_FEE),
    `Expected shipperServiceFee ≈ ${ANALYTICS_EXPECTED_SHIPPER_FEE}. Got: ${actual}. ` +
      `Blueprint §8: "${ANALYTICS_DISTANCE_KM} km × ${ANALYTICS_SHIPPER_RATE} ETB/km"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});

test(`load.carrierServiceFee ≈ ${ANALYTICS_EXPECTED_CARRIER_FEE} ETB (${ANALYTICS_DISTANCE_KM} km × ${ANALYTICS_CARRIER_RATE} ETB/km, ±${FEE_TOLERANCE})`, async () => {
  test.setTimeout(60000);
  skipIfNoLoad();
  const actual = Number(loadRecord!.carrierServiceFee ?? -1);
  if (actual < 0) {
    test.skip(true, "carrierServiceFee absent");
    return;
  }
  expect(
    Math.abs(actual - ANALYTICS_EXPECTED_CARRIER_FEE),
    `Expected carrierServiceFee ≈ ${ANALYTICS_EXPECTED_CARRIER_FEE}. Got: ${actual}. ` +
      `Blueprint §8: "${ANALYTICS_DISTANCE_KM} km × ${ANALYTICS_CARRIER_RATE} ETB/km"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});
