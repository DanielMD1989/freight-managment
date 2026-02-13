/**
 * Rounding Module Tests
 *
 * Tests for all rounding strategies in the freight management system
 */

import {
  roundMoney,
  formatMoney,
  roundPercentage,
  roundPercentage2,
  formatPercentage,
  formatPercentage2,
  roundDistance,
  roundDistance1,
  formatDistance,
  formatDistance1,
  roundCoordinate,
  roundCoordinate6,
  formatCoordinate,
  formatCoordinate6,
  roundToDecimals,
  round,
} from '@/lib/rounding';

describe('lib/rounding', () => {
  // ============================================================================
  // MONEY ROUNDING (2 decimal places)
  // ============================================================================
  describe('roundMoney', () => {
    it('should round to 2 decimal places', () => {
      expect(roundMoney(123.456)).toBe(123.46);
      expect(roundMoney(123.454)).toBe(123.45);
    });

    it('should handle exact values', () => {
      expect(roundMoney(100)).toBe(100);
      expect(roundMoney(100.00)).toBe(100);
      expect(roundMoney(99.99)).toBe(99.99);
    });

    it('should round up at 0.005', () => {
      expect(roundMoney(100.005)).toBe(100.01);
      expect(roundMoney(100.004)).toBe(100);
    });

    it('should handle small values', () => {
      expect(roundMoney(0.001)).toBe(0);
      expect(roundMoney(0.005)).toBe(0.01);
      expect(roundMoney(0.01)).toBe(0.01);
    });

    it('should handle large values', () => {
      expect(roundMoney(1000000.999)).toBe(1000001);
      expect(roundMoney(999999.994)).toBe(999999.99);
    });

    it('should handle negative values', () => {
      expect(roundMoney(-123.456)).toBe(-123.46);
      expect(roundMoney(-100.005)).toBe(-100);
    });
  });

  describe('formatMoney', () => {
    it('should format with 2 decimal places', () => {
      expect(formatMoney(100)).toBe('100.00');
      expect(formatMoney(123.4)).toBe('123.40');
      expect(formatMoney(99.99)).toBe('99.99');
    });
  });

  // ============================================================================
  // PERCENTAGE ROUNDING
  // ============================================================================
  describe('roundPercentage', () => {
    it('should round to 1 decimal place', () => {
      expect(roundPercentage(85.67)).toBe(85.7);
      expect(roundPercentage(85.64)).toBe(85.6);
    });

    it('should handle edge cases', () => {
      expect(roundPercentage(100)).toBe(100);
      expect(roundPercentage(0)).toBe(0);
      expect(roundPercentage(99.95)).toBe(100);
    });
  });

  describe('roundPercentage2', () => {
    it('should round to 2 decimal places', () => {
      expect(roundPercentage2(85.678)).toBe(85.68);
      expect(roundPercentage2(85.674)).toBe(85.67);
    });

    it('should handle trust scores', () => {
      expect(roundPercentage2(95.555)).toBe(95.56);
      expect(roundPercentage2(0.005)).toBe(0.01);
    });
  });

  describe('formatPercentage', () => {
    it('should format with 1 decimal place', () => {
      expect(formatPercentage(85.6)).toBe('85.6');
      expect(formatPercentage(100)).toBe('100.0');
    });
  });

  describe('formatPercentage2', () => {
    it('should format with 2 decimal places', () => {
      expect(formatPercentage2(85.67)).toBe('85.67');
      expect(formatPercentage2(100)).toBe('100.00');
    });
  });

  // ============================================================================
  // DISTANCE ROUNDING
  // ============================================================================
  describe('roundDistance', () => {
    it('should round to integer', () => {
      expect(roundDistance(123.6)).toBe(124);
      expect(roundDistance(123.4)).toBe(123);
    });

    it('should handle edge cases', () => {
      expect(roundDistance(0.4)).toBe(0);
      expect(roundDistance(0.5)).toBe(1);
      expect(roundDistance(1000.5)).toBe(1001);
    });
  });

  describe('roundDistance1', () => {
    it('should round to 1 decimal place', () => {
      expect(roundDistance1(123.67)).toBe(123.7);
      expect(roundDistance1(123.64)).toBe(123.6);
    });

    it('should handle small distances', () => {
      expect(roundDistance1(0.05)).toBe(0.1);
      expect(roundDistance1(0.04)).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format with 0 decimal places', () => {
      expect(formatDistance(124)).toBe('124');
      expect(formatDistance(123.6)).toBe('124');
    });
  });

  describe('formatDistance1', () => {
    it('should format with 1 decimal place', () => {
      expect(formatDistance1(123.67)).toBe('123.7');
      expect(formatDistance1(100)).toBe('100.0');
    });
  });

  // ============================================================================
  // COORDINATE ROUNDING
  // ============================================================================
  describe('roundCoordinate', () => {
    it('should round to 4 decimal places', () => {
      expect(roundCoordinate(9.00545678)).toBe(9.0055);
      expect(roundCoordinate(38.76364321)).toBe(38.7636);
    });

    it('should handle Ethiopian coordinates', () => {
      // Addis Ababa area
      expect(roundCoordinate(9.005412345)).toBe(9.0054);
      expect(roundCoordinate(38.763612345)).toBe(38.7636);
    });
  });

  describe('roundCoordinate6', () => {
    it('should round to 6 decimal places', () => {
      expect(roundCoordinate6(9.0054567890)).toBe(9.005457);
      expect(roundCoordinate6(38.7636432190)).toBe(38.763643);
    });

    it('should provide higher precision', () => {
      const coord4 = roundCoordinate(9.0054567890);
      const coord6 = roundCoordinate6(9.0054567890);

      expect(coord6).not.toBe(coord4);
      expect(coord6).toBe(9.005457);
    });
  });

  describe('formatCoordinate', () => {
    it('should format with 4 decimal places', () => {
      expect(formatCoordinate(9.0054)).toBe('9.0054');
      expect(formatCoordinate(38.7636)).toBe('38.7636');
    });
  });

  describe('formatCoordinate6', () => {
    it('should format with 6 decimal places', () => {
      expect(formatCoordinate6(9.005457)).toBe('9.005457');
      expect(formatCoordinate6(38.763643)).toBe('38.763643');
    });
  });

  // ============================================================================
  // GENERIC ROUNDING
  // ============================================================================
  describe('roundToDecimals', () => {
    it('should round to specified decimal places', () => {
      expect(roundToDecimals(123.456789, 0)).toBe(123);
      expect(roundToDecimals(123.456789, 1)).toBe(123.5);
      expect(roundToDecimals(123.456789, 2)).toBe(123.46);
      expect(roundToDecimals(123.456789, 3)).toBe(123.457);
    });

    it('should throw for invalid decimal values', () => {
      expect(() => roundToDecimals(100, -1)).toThrow('Decimals must be between 0 and 10');
      expect(() => roundToDecimals(100, 11)).toThrow('Decimals must be between 0 and 10');
    });

    it('should handle edge values', () => {
      expect(roundToDecimals(100, 0)).toBe(100);
      expect(roundToDecimals(100, 10)).toBe(100);
    });
  });

  describe('round (type-based)', () => {
    it('should apply money rounding', () => {
      expect(round(123.456, 'money')).toBe(123.46);
    });

    it('should apply percentage rounding', () => {
      expect(round(85.67, 'percentage')).toBe(85.7);
    });

    it('should apply percentage2 rounding', () => {
      expect(round(85.678, 'percentage2')).toBe(85.68);
    });

    it('should apply distance rounding', () => {
      expect(round(123.6, 'distance')).toBe(124);
    });

    it('should apply distance1 rounding', () => {
      expect(round(123.67, 'distance1')).toBe(123.7);
    });

    it('should apply coordinate rounding', () => {
      expect(round(9.00545678, 'coordinate')).toBe(9.0055);
    });

    it('should apply coordinate6 rounding', () => {
      expect(round(9.0054567890, 'coordinate6')).toBe(9.005457);
    });
  });
});
