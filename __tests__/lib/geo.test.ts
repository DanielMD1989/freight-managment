/**
 * Geo Module Tests
 *
 * Tests for distance calculations using Haversine formula
 */

import {
  calculateDistanceKm,
  calculateDistanceMeters,
  haversineDistance,
} from "@/lib/geo";

describe("lib/geo", () => {
  describe("calculateDistanceKm", () => {
    it("should return 0 for same point", () => {
      const distance = calculateDistanceKm(9.0, 38.75, 9.0, 38.75);
      expect(distance).toBe(0);
    });

    it("should calculate distance between Addis Ababa and Dire Dawa", () => {
      // Addis Ababa: 9.0054, 38.7636
      // Dire Dawa: 9.6009, 41.8502
      // Approximate straight-line distance: ~310km
      const distance = calculateDistanceKm(9.0054, 38.7636, 9.6009, 41.8502);

      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(350);
    });

    it("should calculate distance between Addis Ababa and Djibouti", () => {
      // Addis Ababa: 9.0054, 38.7636
      // Djibouti: 11.5886, 43.1451
      // Approximate straight-line distance: ~559km
      const distance = calculateDistanceKm(9.0054, 38.7636, 11.5886, 43.1451);

      expect(distance).toBeGreaterThan(530);
      expect(distance).toBeLessThan(590);
    });

    it("should return 0 for invalid latitude (> 90)", () => {
      const distance = calculateDistanceKm(91, 38.0, 9.0, 38.0);
      expect(distance).toBe(0);
    });

    it("should return 0 for invalid latitude (< -90)", () => {
      const distance = calculateDistanceKm(-91, 38.0, 9.0, 38.0);
      expect(distance).toBe(0);
    });

    it("should return 0 for invalid longitude (> 180)", () => {
      const distance = calculateDistanceKm(9.0, 181, 9.0, 38.0);
      expect(distance).toBe(0);
    });

    it("should return 0 for invalid longitude (< -180)", () => {
      const distance = calculateDistanceKm(9.0, -181, 9.0, 38.0);
      expect(distance).toBe(0);
    });

    it("should return 0 for NaN inputs", () => {
      expect(calculateDistanceKm(NaN, 38.0, 9.0, 38.0)).toBe(0);
      expect(calculateDistanceKm(9.0, NaN, 9.0, 38.0)).toBe(0);
      expect(calculateDistanceKm(9.0, 38.0, NaN, 38.0)).toBe(0);
      expect(calculateDistanceKm(9.0, 38.0, 9.0, NaN)).toBe(0);
    });

    it("should return 0 for Infinity inputs", () => {
      expect(calculateDistanceKm(Infinity, 38.0, 9.0, 38.0)).toBe(0);
      expect(calculateDistanceKm(9.0, Infinity, 9.0, 38.0)).toBe(0);
      expect(calculateDistanceKm(9.0, 38.0, Infinity, 38.0)).toBe(0);
      expect(calculateDistanceKm(9.0, 38.0, 9.0, Infinity)).toBe(0);
    });

    it("should handle boundary values (poles)", () => {
      // North Pole to Equator
      const npToEq = calculateDistanceKm(90, 0, 0, 0);
      // Should be approximately 10,000 km (quarter of Earth circumference)
      expect(npToEq).toBeGreaterThan(9900);
      expect(npToEq).toBeLessThan(10100);
    });

    it("should handle negative coordinates (Southern Hemisphere)", () => {
      // Johannesburg, South Africa: -26.2041, 28.0473
      // Cape Town, South Africa: -33.9249, 18.4241
      const distance = calculateDistanceKm(
        -26.2041,
        28.0473,
        -33.9249,
        18.4241
      );

      // Approximate straight-line distance: ~1270km
      expect(distance).toBeGreaterThan(1200);
      expect(distance).toBeLessThan(1350);
    });

    it("should be symmetric (A to B = B to A)", () => {
      const ab = calculateDistanceKm(9.0, 38.0, 12.0, 42.0);
      const ba = calculateDistanceKm(12.0, 42.0, 9.0, 38.0);

      expect(ab).toBeCloseTo(ba, 10);
    });

    it("should handle very small distances", () => {
      // ~100 meters apart
      const distance = calculateDistanceKm(9.0, 38.0, 9.0009, 38.0);

      expect(distance).toBeGreaterThan(0.08);
      expect(distance).toBeLessThan(0.15);
    });
  });

  describe("calculateDistanceMeters", () => {
    it("should return 0 for same point", () => {
      const distance = calculateDistanceMeters(9.0, 38.75, 9.0, 38.75);
      expect(distance).toBe(0);
    });

    it("should return distance in meters", () => {
      // About 1km apart
      const distance = calculateDistanceMeters(9.0, 38.0, 9.009, 38.0);

      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1100);
    });

    it("should return 0 for invalid coordinates", () => {
      expect(calculateDistanceMeters(91, 38.0, 9.0, 38.0)).toBe(0);
      expect(calculateDistanceMeters(NaN, 38.0, 9.0, 38.0)).toBe(0);
    });
  });

  describe("haversineDistance (alias)", () => {
    it("should be an alias for calculateDistanceKm", () => {
      const km = calculateDistanceKm(9.0054, 38.7636, 9.6009, 41.8502);
      const alias = haversineDistance(9.0054, 38.7636, 9.6009, 41.8502);

      expect(km).toBe(alias);
    });
  });
});
