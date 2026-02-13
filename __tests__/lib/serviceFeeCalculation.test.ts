/**
 * Service Fee Calculation Tests
 *
 * Tests for fee calculation business logic
 */

import { calculatePartyFee, calculateFeePreview, calculateDualPartyFeePreview, calculateFeeFromCorridor, calculateFeesFromCorridor } from '@/lib/serviceFeeCalculation';

describe('lib/serviceFeeCalculation', () => {
  // ============================================================================
  // calculatePartyFee - Primary fee calculation
  // ============================================================================
  describe('calculatePartyFee', () => {
    it('should calculate fee correctly (distance × rate)', () => {
      // 100km × 5 ETB/km = 500 ETB
      const result = calculatePartyFee(100, 5, false, null);

      expect(result.baseFee).toBe(500);
      expect(result.finalFee).toBe(500);
      expect(result.promoDiscount).toBe(0);
      expect(result.promoApplied).toBe(false);
    });

    it('should apply promo discount when enabled', () => {
      // 100km × 5 ETB/km = 500 ETB base
      // 10% promo = 50 ETB discount
      // Final = 450 ETB
      const result = calculatePartyFee(100, 5, true, 10);

      expect(result.baseFee).toBe(500);
      expect(result.promoDiscount).toBe(50);
      expect(result.finalFee).toBe(450);
      expect(result.promoApplied).toBe(true);
      expect(result.promoDiscountPct).toBe(10);
    });

    it('should not apply promo when flag is false', () => {
      const result = calculatePartyFee(100, 5, false, 10);

      expect(result.finalFee).toBe(500);
      expect(result.promoApplied).toBe(false);
    });

    it('should not apply promo when percentage is null', () => {
      const result = calculatePartyFee(100, 5, true, null);

      expect(result.finalFee).toBe(500);
      expect(result.promoApplied).toBe(false);
    });

    it('should not apply promo when percentage is 0', () => {
      const result = calculatePartyFee(100, 5, true, 0);

      expect(result.finalFee).toBe(500);
      expect(result.promoApplied).toBe(false);
    });

    it('should return zero fee for zero distance', () => {
      const result = calculatePartyFee(0, 5, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
      expect(result.pricePerKm).toBe(0);
    });

    it('should return zero fee for negative distance', () => {
      const result = calculatePartyFee(-100, 5, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
    });

    it('should return zero fee for zero price per km', () => {
      const result = calculatePartyFee(100, 0, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
    });

    it('should return zero fee for negative price per km', () => {
      const result = calculatePartyFee(100, -5, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
    });

    it('should return zero fee for NaN distance', () => {
      const result = calculatePartyFee(NaN, 5, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
    });

    it('should return zero fee for Infinity distance', () => {
      const result = calculatePartyFee(Infinity, 5, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
    });

    it('should return zero fee for NaN price', () => {
      const result = calculatePartyFee(100, NaN, false, null);

      expect(result.baseFee).toBe(0);
      expect(result.finalFee).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // 100km × 3.333 ETB/km = 333.3 ETB
      const result = calculatePartyFee(100, 3.333, false, null);

      expect(result.baseFee).toBe(333.3);
      expect(result.finalFee).toBe(333.3);
    });

    it('should round promo discount to 2 decimal places', () => {
      // 100km × 3.333 = 333.3 ETB
      // 15% promo = 49.995 → 50 ETB discount
      const result = calculatePartyFee(100, 3.333, true, 15);

      expect(result.baseFee).toBe(333.3);
      expect(result.promoDiscount).toBe(50); // Rounded from 49.995
      expect(result.finalFee).toBeCloseTo(283.3, 1); // Allow minor rounding variance
    });

    it('should handle very large distances', () => {
      // 10,000km × 5 ETB/km = 50,000 ETB
      const result = calculatePartyFee(10000, 5, false, null);

      expect(result.baseFee).toBe(50000);
      expect(result.finalFee).toBe(50000);
    });

    it('should handle very small rates', () => {
      // 100km × 0.01 ETB/km = 1 ETB
      const result = calculatePartyFee(100, 0.01, false, null);

      expect(result.baseFee).toBe(1);
      expect(result.finalFee).toBe(1);
    });
  });

  // ============================================================================
  // calculateFeePreview - Simplified preview calculation
  // ============================================================================
  describe('calculateFeePreview', () => {
    it('should calculate same results as calculatePartyFee', () => {
      const preview = calculateFeePreview(100, 5, false, null);
      const party = calculatePartyFee(100, 5, false, null);

      expect(preview.baseFee).toBe(party.baseFee);
      expect(preview.finalFee).toBe(party.finalFee);
    });

    it('should apply promo discount', () => {
      const result = calculateFeePreview(100, 5, true, 10);

      expect(result.baseFee).toBe(500);
      expect(result.discount).toBe(50);
      expect(result.finalFee).toBe(450);
    });

    it('should return zero for invalid inputs', () => {
      expect(calculateFeePreview(0, 5, false, null).finalFee).toBe(0);
      expect(calculateFeePreview(-100, 5, false, null).finalFee).toBe(0);
      expect(calculateFeePreview(100, 0, false, null).finalFee).toBe(0);
      expect(calculateFeePreview(NaN, 5, false, null).finalFee).toBe(0);
      expect(calculateFeePreview(Infinity, 5, false, null).finalFee).toBe(0);
    });
  });

  // ============================================================================
  // calculateDualPartyFeePreview - Shipper + Carrier fees
  // ============================================================================
  describe('calculateDualPartyFeePreview', () => {
    it('should calculate fees for both shipper and carrier', () => {
      const result = calculateDualPartyFeePreview(
        100,     // distance
        5,       // shipper price/km
        false,   // shipper promo
        null,    // shipper promo %
        3,       // carrier price/km
        false,   // carrier promo
        null     // carrier promo %
      );

      expect(result.shipper.finalFee).toBe(500);
      expect(result.carrier.finalFee).toBe(300);
      expect(result.totalPlatformFee).toBe(800);
    });

    it('should apply different promos to each party', () => {
      const result = calculateDualPartyFeePreview(
        100,     // distance
        5,       // shipper price/km
        true,    // shipper promo
        10,      // shipper 10% discount
        3,       // carrier price/km
        true,    // carrier promo
        20       // carrier 20% discount
      );

      expect(result.shipper.finalFee).toBe(450); // 500 - 50
      expect(result.carrier.finalFee).toBe(240); // 300 - 60
      expect(result.totalPlatformFee).toBe(690);
    });

    it('should handle zero carrier fee (shipper-only corridor)', () => {
      const result = calculateDualPartyFeePreview(
        100, 5, false, null,
        0, false, null  // Zero carrier rate
      );

      expect(result.shipper.finalFee).toBe(500);
      expect(result.carrier.finalFee).toBe(0);
      expect(result.totalPlatformFee).toBe(500);
    });
  });

  // ============================================================================
  // calculateFeeFromCorridor - Legacy single-party fee
  // ============================================================================
  describe('calculateFeeFromCorridor (legacy)', () => {
    it('should calculate fee for corridor', () => {
      const result = calculateFeeFromCorridor(500, 3.5, false, null);

      expect(result.baseFee).toBe(1750);
      expect(result.finalFee).toBe(1750);
      expect(result.promoApplied).toBe(false);
    });

    it('should apply promo discount', () => {
      const result = calculateFeeFromCorridor(500, 3.5, true, 15);

      expect(result.baseFee).toBe(1750);
      expect(result.promoDiscount).toBe(262.5);
      expect(result.finalFee).toBe(1487.5);
      expect(result.promoApplied).toBe(true);
    });
  });

  // ============================================================================
  // calculateFeesFromCorridor - Both parties from corridor object
  // ============================================================================
  describe('calculateFeesFromCorridor', () => {
    it('should calculate fees from corridor object', () => {
      const corridor = {
        id: 'test-corridor',
        name: 'Addis - Djibouti',
        originRegion: 'Addis Ababa',
        destinationRegion: 'Djibouti',
        distanceKm: 910,
        direction: 'ONE_WAY' as const,
        isActive: true,
        shipperPricePerKm: 3.5,
        shipperPromoFlag: false,
        shipperPromoPct: null,
        carrierPricePerKm: 2.0,
        carrierPromoFlag: false,
        carrierPromoPct: null,
        pricePerKm: 3.5,
        promoFlag: false,
        promoDiscountPct: null,
      };

      const result = calculateFeesFromCorridor(corridor);

      expect(result.shipper.finalFee).toBe(3185); // 910 × 3.5
      expect(result.carrier.finalFee).toBe(1820); // 910 × 2.0
      expect(result.totalPlatformFee).toBe(5005);
    });

    it('should handle corridor with promos', () => {
      const corridor = {
        id: 'test-corridor',
        name: 'Addis - Djibouti',
        originRegion: 'Addis Ababa',
        destinationRegion: 'Djibouti',
        distanceKm: 100,
        direction: 'ONE_WAY' as const,
        isActive: true,
        shipperPricePerKm: 5,
        shipperPromoFlag: true,
        shipperPromoPct: 10,
        carrierPricePerKm: 3,
        carrierPromoFlag: true,
        carrierPromoPct: 20,
        pricePerKm: 5,
        promoFlag: true,
        promoDiscountPct: 10,
      };

      const result = calculateFeesFromCorridor(corridor);

      expect(result.shipper.finalFee).toBe(450); // 500 - 50
      expect(result.carrier.finalFee).toBe(240); // 300 - 60
      expect(result.totalPlatformFee).toBe(690);
    });
  });

  // ============================================================================
  // Edge cases and business scenarios
  // ============================================================================
  describe('business scenarios', () => {
    it('should handle typical Ethiopian corridor (Addis-Djibouti)', () => {
      // ~910km corridor
      // Shipper: 3.5 ETB/km
      // Carrier: 2.0 ETB/km
      const result = calculateDualPartyFeePreview(
        910, 3.5, false, null,
        2.0, false, null
      );

      expect(result.shipper.finalFee).toBe(3185);
      expect(result.carrier.finalFee).toBe(1820);
      expect(result.totalPlatformFee).toBe(5005);
    });

    it('should handle short haul (Addis-Adama ~100km)', () => {
      const result = calculateDualPartyFeePreview(
        100, 4.0, false, null,
        2.5, false, null
      );

      expect(result.shipper.finalFee).toBe(400);
      expect(result.carrier.finalFee).toBe(250);
      expect(result.totalPlatformFee).toBe(650);
    });

    it('should handle promotional pricing', () => {
      // 50% promo discount for new corridor
      const result = calculateDualPartyFeePreview(
        500, 3.0, true, 50,
        2.0, true, 50
      );

      expect(result.shipper.finalFee).toBe(750);  // 1500 - 750
      expect(result.carrier.finalFee).toBe(500);  // 1000 - 500
      expect(result.totalPlatformFee).toBe(1250);
    });
  });
});
