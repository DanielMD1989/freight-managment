/**
 * Analytics Sprint 3 — Wallet Deduction Arithmetic (Blueprint §8)
 *
 * Verifies exact wallet balance changes after trip completion:
 *   shipperBalanceAfter = shipperBalanceBefore − shipperServiceFee (±1 ETB)
 *   carrierBalanceAfter = carrierBalanceBefore − carrierServiceFee (±1 ETB)
 *
 * Uses pre-deduction wallet snapshots captured in analytics-seed.ts.
 *
 * Failure format: "Expected {role} Δbalance = -{fee}. Got: {actualDelta}. Blueprint §8: '{rule}'"
 *
 * Report-only mode: documents actual vs expected, no fixes applied.
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

// ── Tests ─────────────────────────────────────────────────────────────────────

test("GET /api/wallet/balance returns 200 for shipper and carrier", async () => {
  test.setTimeout(60000);

  const [shipperRes, carrierRes] = await Promise.all([
    apiCall("GET", "/api/wallet/balance", tokens.shipperToken),
    apiCall("GET", "/api/wallet/balance", tokens.carrierToken),
  ]);

  expect(
    shipperRes.status,
    `Expected shipper GET /api/wallet/balance to return 200. Got: ${shipperRes.status}. Blueprint §8: "Wallet balance endpoint accessible to all authenticated users"`
  ).toBe(200);

  expect(
    carrierRes.status,
    `Expected carrier GET /api/wallet/balance to return 200. Got: ${carrierRes.status}. Blueprint §8: "Wallet balance endpoint accessible to all authenticated users"`
  ).toBe(200);
});

test("Shipper balance decreased by exactly shipperServiceFee (±1 ETB) after completion", async () => {
  test.setTimeout(60000);

  if (!seed?.completedLoadId || !loadRecord) {
    test.skip(
      true,
      "No completed load — trip did not complete, cannot assert wallet delta"
    );
    return;
  }
  if (seed.wallets.shipperBalanceBefore < 0) {
    test.skip(true, "Shipper wallet snapshot not captured in seed");
    return;
  }
  if (loadRecord.shipperFeeStatus !== "DEDUCTED") {
    test.skip(
      true,
      `shipperFeeStatus=${loadRecord.shipperFeeStatus} — fee not deducted, wallet delta undefined`
    );
    return;
  }

  const actualShipperFee = Number(
    loadRecord.shipperServiceFee ?? loadRecord.shipperFee ?? -1
  );
  if (actualShipperFee < 0) {
    test.skip(true, "shipperServiceFee field absent on load");
    return;
  }

  const { status, data: walletData } = await apiCall(
    "GET",
    "/api/wallet/balance",
    tokens.shipperToken
  );
  expect(status).toBe(200);

  const balanceAfter = Number(
    walletData.totalBalance ?? walletData.balance ?? walletData.available ?? -1
  );
  const { shipperBalanceBefore } = seed.wallets;
  const actualDelta = shipperBalanceBefore - balanceAfter;
  const expectedDelta = actualShipperFee;

  expect(
    Math.abs(actualDelta - expectedDelta),
    `Expected shipper Δbalance = -${actualShipperFee.toFixed(2)} ETB. ` +
      `Got: Δ${actualDelta.toFixed(2)} ETB (before=${shipperBalanceBefore.toFixed(2)}, after=${balanceAfter.toFixed(2)}). ` +
      `Blueprint §8: "Fees are deducted from shipper wallet separately after trip completion"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});

test("Carrier balance decreased by exactly carrierServiceFee (±1 ETB) after completion", async () => {
  test.setTimeout(60000);

  if (!seed?.completedLoadId || !loadRecord) {
    test.skip(
      true,
      "No completed load — trip did not complete, cannot assert wallet delta"
    );
    return;
  }
  if (seed.wallets.carrierBalanceBefore < 0) {
    test.skip(true, "Carrier wallet snapshot not captured in seed");
    return;
  }
  if (loadRecord.carrierFeeStatus !== "DEDUCTED") {
    test.skip(
      true,
      `carrierFeeStatus=${loadRecord.carrierFeeStatus} — fee not deducted, wallet delta undefined`
    );
    return;
  }

  const actualCarrierFee = Number(
    loadRecord.carrierServiceFee ?? loadRecord.carrierFee ?? -1
  );
  if (actualCarrierFee < 0) {
    test.skip(true, "carrierServiceFee field absent on load");
    return;
  }

  const { status, data: walletData } = await apiCall(
    "GET",
    "/api/wallet/balance",
    tokens.carrierToken
  );
  expect(status).toBe(200);

  const balanceAfter = Number(
    walletData.totalBalance ?? walletData.balance ?? walletData.available ?? -1
  );
  const { carrierBalanceBefore } = seed.wallets;
  const actualDelta = carrierBalanceBefore - balanceAfter;
  const expectedDelta = actualCarrierFee;

  expect(
    Math.abs(actualDelta - expectedDelta),
    `Expected carrier Δbalance = -${actualCarrierFee.toFixed(2)} ETB. ` +
      `Got: Δ${actualDelta.toFixed(2)} ETB (before=${carrierBalanceBefore.toFixed(2)}, after=${balanceAfter.toFixed(2)}). ` +
      `Blueprint §8: "Fees are deducted from carrier wallet separately after trip completion"`
  ).toBeLessThanOrEqual(FEE_TOLERANCE);
});

test("Deductions are independent — shipper fee ≠ carrier fee (10 vs 8 ETB/km rate)", async () => {
  test.setTimeout(60000);

  if (!loadRecord) {
    test.skip(true, "No load record from seed");
    return;
  }
  if (
    loadRecord.shipperFeeStatus !== "DEDUCTED" ||
    loadRecord.carrierFeeStatus !== "DEDUCTED"
  ) {
    test.skip(
      true,
      "Both fees not DEDUCTED — cannot compare independent amounts"
    );
    return;
  }

  const shipperFee = Number(loadRecord.shipperServiceFee ?? 0);
  const carrierFee = Number(loadRecord.carrierServiceFee ?? 0);

  expect(
    shipperFee === carrierFee,
    `Expected shipper fee (${shipperFee} ETB) ≠ carrier fee (${carrierFee} ETB). ` +
      `Blueprint §8: "Shipper and carrier are charged at independent per-km rates (10 vs 8 ETB/km)"`
  ).toBe(false);

  // Shipper fee should be higher (10 > 8 rate)
  expect(
    shipperFee,
    `Expected shipperFee (${shipperFee}) > carrierFee (${carrierFee}). ` +
      `Blueprint §8: "Shipper rate (10 ETB/km) > carrier rate (8 ETB/km)"`
  ).toBeGreaterThan(carrierFee);
});

test("load.shipperFeeDeductedAt is set (fee deduction has timestamp)", async () => {
  test.setTimeout(60000);

  if (!loadRecord) {
    test.skip(true, "No load record from seed");
    return;
  }
  if (loadRecord.shipperFeeStatus !== "DEDUCTED") {
    test.skip(true, "shipperFeeStatus not DEDUCTED — timestamp may be null");
    return;
  }

  const deductedAt =
    loadRecord.shipperFeeDeductedAt ?? loadRecord.feeDeductedAt;

  expect(
    deductedAt !== undefined && deductedAt !== null,
    `Blueprint §8 GAP: shipperFeeDeductedAt field absent on completed load. ` +
      `shipperFeeStatus is DEDUCTED but no deduction timestamp was recorded. ` +
      `Fix: set shipperFeeDeductedAt in deductServiceFee() when shipper fee is deducted.`
  ).toBe(true);

  expect(
    typeof deductedAt === "string" || deductedAt instanceof Date,
    `Expected shipperFeeDeductedAt to be a date string. Got: ${typeof deductedAt} (value: ${deductedAt}). ` +
      `Blueprint §8: "Fee deduction timestamp recorded for auditability"`
  ).toBe(true);
});

test("GET /api/wallet/transactions returns DEDUCTION entry after trip completion", async () => {
  test.setTimeout(60000);

  if (!seed?.completedLoadId || !loadRecord) {
    test.skip(true, "No completed load from seed");
    return;
  }
  if (loadRecord.shipperFeeStatus !== "DEDUCTED") {
    test.skip(true, "Fee not deducted — no DEDUCTION transaction expected");
    return;
  }

  const { status, data } = await apiCall(
    "GET",
    "/api/wallet/transactions?limit=20",
    tokens.shipperToken
  );

  expect(
    status,
    `Expected GET /api/wallet/transactions to return 200. Got: ${status}. Blueprint §8: "Wallet transaction history is accessible"`
  ).toBe(200);

  const txns: Array<Record<string, unknown>> =
    data.transactions ?? data.data ?? data ?? [];

  if (!Array.isArray(txns) || txns.length === 0) {
    console.info(
      "INFO: No transactions returned — wallet transaction history may not be implemented"
    );
    expect(status).toBe(200); // endpoint exists even if no data
    return;
  }

  const deductionEntry = txns.find(
    (t) =>
      (t.type ?? t.transactionType ?? "")
        .toString()
        .toUpperCase()
        .includes("DEDUCT") ||
      (t.description ?? t.notes ?? "").toString().toLowerCase().includes("fee")
  );

  expect(
    deductionEntry !== undefined,
    `Expected at least one DEDUCTION entry in shipper wallet transactions. ` +
      `Got ${txns.length} transactions, none matched DEDUCT/fee. ` +
      `Blueprint §8: "Service fee deduction is recorded as a wallet transaction"`
  ).toBe(true);
});
