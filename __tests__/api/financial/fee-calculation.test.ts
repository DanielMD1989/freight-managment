// @jest-environment node
/**
 * Service Fee Calculation Edge Cases (GAP-J, GAP-K, GAP-L)
 *
 * Tests calculatePartyFee() from lib/serviceFeeCalculation.ts directly.
 * No DB or route handler involved — pure unit tests for financial precision.
 *
 * GAP-J: Shipper promo rate applied correctly (Decimal.js precision)
 * GAP-K: Carrier zero fee when carrierPricePerKm is null/0
 * GAP-L: Promo discount exceeding base fee → clamped to 0 (not negative)
 */

import { calculatePartyFee } from "@/lib/serviceFeeCalculation";

describe("calculatePartyFee — edge cases", () => {
  // ─── GAP-J: Shipper promo rate ───────────────────────────────────────────

  it("GAP-J: shipper promo rate reduces fee without float drift", () => {
    // Base: 500km × 1.0 ETB/km = 500 ETB
    // Promo: 10% off → discount = 50 ETB → net = 450 ETB
    const result = calculatePartyFee(
      500, // distanceKm
      1.0, // pricePerKm (shipperPricePerKm)
      true, // shipperPromoFlag
      10 // shipperPromoPct = 10%
    );

    expect(result.baseFee).toBe(500);
    expect(result.promoDiscount).toBe(50);
    expect(result.finalFee).toBe(450);
    expect(result.promoApplied).toBe(true);
    expect(result.promoDiscountPct).toBe(10);

    // Decimal.js precision: result must be exact, no float drift
    // e.g. 500 * 0.9 in IEEE 754 can produce 449.99999999999994
    expect(result.finalFee).toStrictEqual(450);
  });

  it("GAP-J: promo rate with fractional km preserves 2dp precision", () => {
    // 333km × 1.5 ETB/km = 499.50 ETB, 10% off → 449.55 ETB
    const result = calculatePartyFee(333, 1.5, true, 10);

    expect(result.baseFee).toBe(499.5);
    expect(result.promoDiscount).toBe(49.95);
    expect(result.finalFee).toBe(449.55);
    // No float drift: 333 * 1.5 * 0.9 in IEEE 754 = 449.55000000000007 (drift)
    expect(Number.isFinite(result.finalFee)).toBe(true);
    expect(result.finalFee.toString()).not.toContain("0000000");
  });

  // ─── GAP-K: Carrier zero fee when pricePerKm is null/0 ───────────────────

  it("GAP-K: carrier fee is 0 when carrierPricePerKm is 0 (no debit)", () => {
    // When corridor has no carrier price configured, fee should be zero
    const result = calculatePartyFee(
      500, // distanceKm
      0, // carrierPricePerKm = 0 (null → 0 via mapCorridorToMatch)
      false,
      null
    );

    expect(result.finalFee).toBe(0);
    expect(result.baseFee).toBe(0);
    expect(result.promoDiscount).toBe(0);
    expect(result.promoApplied).toBe(false);
  });

  it("GAP-K: carrier fee is 0 when carrierPricePerKm is negative (guard)", () => {
    // Negative price should also return zero (invalid input guard)
    const result = calculatePartyFee(500, -1, false, null);

    expect(result.finalFee).toBe(0);
    expect(result.baseFee).toBe(0);
  });

  // ─── GAP-L: Promo discount exceeds base fee → clamped to 0 ───────────────

  it("GAP-L: promo discount > base fee is clamped to 0 (not negative)", () => {
    // distanceKm=100, pricePerKm=1 → baseFee=100
    // promoDiscountPct=120% → discount = 120 → net = 100 - 120 = -20 → clamp → 0
    const result = calculatePartyFee(
      100, // distanceKm
      1, // pricePerKm
      true, // promoFlag
      120 // promoDiscountPct = 120% (absurd — tests clamp guard)
    );

    expect(result.baseFee).toBe(100);
    expect(result.promoDiscount).toBe(120);
    // Critical: finalFee must be 0, not -20
    expect(result.finalFee).toBe(0);
    expect(result.finalFee).toBeGreaterThanOrEqual(0);
    expect(result.promoApplied).toBe(true);
  });

  it("GAP-L: promo discount exactly equal to base fee → 0 (boundary)", () => {
    // promo = 100% → discount = baseFee → net = 0 (exact boundary, not negative)
    const result = calculatePartyFee(200, 2.5, true, 100);

    expect(result.baseFee).toBe(500);
    expect(result.promoDiscount).toBe(500);
    expect(result.finalFee).toBe(0);
    expect(result.finalFee).toBeGreaterThanOrEqual(0);
  });
});
