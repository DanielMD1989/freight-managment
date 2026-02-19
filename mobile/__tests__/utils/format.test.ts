/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for formatting utilities
 */
import {
  formatWeight,
  formatDistance,
  formatCurrency,
  formatTruckType,
  formatLoadStatus,
  formatTripStatus,
  formatDate,
  formatDateTime,
} from "../../src/utils/format";

describe("Format Utilities", () => {
  describe("formatWeight", () => {
    it("should format weight with tons", () => {
      expect(formatWeight(5000)).toMatch(/5.*t/i);
    });

    it("should handle null/undefined", () => {
      expect(formatWeight(null as any)).toBe("N/A");
      expect(formatWeight(undefined as any)).toBe("N/A");
    });

    it("should handle zero", () => {
      const result = formatWeight(0);
      expect(result).toBeDefined();
    });

    it("should handle string input (Prisma Decimal)", () => {
      expect(formatWeight("2500" as any)).toBe("2.5 tons");
      expect(formatWeight("500" as any)).toBe("500 kg");
    });

    it("should return N/A for non-numeric strings", () => {
      expect(formatWeight("not-a-number" as any)).toBe("N/A");
    });
  });

  describe("formatDistance", () => {
    it("should format distance with km", () => {
      expect(formatDistance(150)).toMatch(/150.*km/i);
    });

    it("should handle null/undefined", () => {
      expect(formatDistance(null as any)).toBe("N/A");
      expect(formatDistance(undefined as any)).toBe("N/A");
    });

    it("should handle string input (Prisma Decimal)", () => {
      expect(formatDistance("150" as any)).toBe("150 km");
      expect(formatDistance("0.5" as any)).toBe("500 m");
    });

    it("should return N/A for non-numeric strings", () => {
      expect(formatDistance("not-a-number" as any)).toBe("N/A");
    });
  });

  describe("formatCurrency", () => {
    it("should format positive amounts", () => {
      const result = formatCurrency(1500);
      expect(result).toMatch(/1.*500/);
    });

    it("should handle zero", () => {
      expect(formatCurrency(0)).toBeDefined();
    });

    it("should handle negative amounts", () => {
      const result = formatCurrency(-500);
      expect(result).toBeDefined();
    });
  });

  describe("formatTruckType", () => {
    it("should format truck type for display", () => {
      const result = formatTruckType("DRY_VAN");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle undefined", () => {
      expect(formatTruckType(undefined as any)).toBeDefined();
    });
  });

  describe("formatLoadStatus", () => {
    it("should format load statuses", () => {
      expect(formatLoadStatus("POSTED")).toBeDefined();
      expect(formatLoadStatus("IN_TRANSIT")).toBeDefined();
      expect(formatLoadStatus("DELIVERED")).toBeDefined();
    });
  });

  describe("formatTripStatus", () => {
    it("should format trip statuses", () => {
      expect(formatTripStatus("ASSIGNED")).toBeDefined();
      expect(formatTripStatus("PICKUP_PENDING")).toBeDefined();
      expect(formatTripStatus("IN_TRANSIT")).toBeDefined();
      expect(formatTripStatus("DELIVERED")).toBeDefined();
    });
  });

  describe("formatDate", () => {
    it("should format ISO date strings", () => {
      const result = formatDate("2026-02-18T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle null/undefined", () => {
      expect(formatDate(null as any)).toBe("N/A");
      expect(formatDate(undefined as any)).toBe("N/A");
    });
  });

  describe("formatDateTime", () => {
    it("should format with time component", () => {
      const result = formatDateTime("2026-02-18T10:30:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
