/**
 * Admin Metrics Library Tests
 *
 * Regression tests for lib/admin/metrics.ts
 *
 * Focus: EXCEPTION status must be included in TRIP_STATUSES and active count.
 * These tests guard against the BUG-REVERIFY-1 and BUG-REVERIFY-2 class of error
 * (adding a new trip status to the state machine but forgetting to update metrics).
 */

import {
  getTripMetrics,
  TRIP_STATUSES,
  ACTIVE_TRIP_STATUSES,
} from "@/lib/admin/metrics";
import { db } from "@/lib/db";

// Mock the db module
jest.mock("@/lib/db", () => ({
  db: {
    trip: {
      groupBy: jest.fn(),
    },
  },
}));

const mockGroupBy = db.trip.groupBy as jest.Mock;

describe("lib/admin/metrics – TRIP_STATUSES constants", () => {
  // AM-1: EXCEPTION must be listed in TRIP_STATUSES
  it("AM-1: TRIP_STATUSES includes EXCEPTION", () => {
    expect(TRIP_STATUSES).toContain("EXCEPTION");
  });

  // AM-2: ACTIVE_TRIP_STATUSES includes EXCEPTION
  it("AM-2: ACTIVE_TRIP_STATUSES includes EXCEPTION", () => {
    expect(ACTIVE_TRIP_STATUSES).toContain("EXCEPTION");
  });

  // AM-3: TRIP_STATUSES and ACTIVE_TRIP_STATUSES are consistent
  it("AM-3: every ACTIVE_TRIP_STATUS is also in TRIP_STATUSES", () => {
    for (const status of ACTIVE_TRIP_STATUSES) {
      expect(TRIP_STATUSES).toContain(status);
    }
  });
});

describe("lib/admin/metrics – getTripMetrics()", () => {
  beforeEach(() => {
    mockGroupBy.mockReset();
  });

  // AM-4: EXCEPTION trips are counted in byStatus
  it("AM-4: byStatus includes EXCEPTION key when trips are in EXCEPTION", async () => {
    mockGroupBy.mockResolvedValue([
      { status: "ASSIGNED", _count: 2 },
      { status: "IN_TRANSIT", _count: 3 },
      { status: "EXCEPTION", _count: 1 },
      { status: "COMPLETED", _count: 5 },
    ]);

    const metrics = await getTripMetrics();

    expect(metrics.byStatus["EXCEPTION"]).toBe(1);
  });

  // AM-5: EXCEPTION trips are counted in the active total
  it("AM-5: active count includes EXCEPTION trips", async () => {
    mockGroupBy.mockResolvedValue([
      { status: "ASSIGNED", _count: 2 },
      { status: "PICKUP_PENDING", _count: 1 },
      { status: "IN_TRANSIT", _count: 3 },
      { status: "EXCEPTION", _count: 4 },
      { status: "COMPLETED", _count: 5 },
      { status: "CANCELLED", _count: 1 },
    ]);

    const metrics = await getTripMetrics();

    // active = ASSIGNED(2) + PICKUP_PENDING(1) + IN_TRANSIT(3) + EXCEPTION(4) = 10
    expect(metrics.active).toBe(10);
  });

  // AM-6: EXCEPTION absent from DB result → byStatus["EXCEPTION"] = 0 (zero-filled)
  it("AM-6: byStatus[EXCEPTION] = 0 when no trips are in EXCEPTION", async () => {
    mockGroupBy.mockResolvedValue([
      { status: "ASSIGNED", _count: 2 },
      { status: "COMPLETED", _count: 5 },
    ]);

    const metrics = await getTripMetrics();

    expect(metrics.byStatus["EXCEPTION"]).toBe(0);
  });

  // AM-7: EXCEPTION-only fleet → active = EXCEPTION count
  it("AM-7: all trips in EXCEPTION → active equals EXCEPTION count", async () => {
    mockGroupBy.mockResolvedValue([{ status: "EXCEPTION", _count: 7 }]);

    const metrics = await getTripMetrics();

    expect(metrics.active).toBe(7);
    expect(metrics.total).toBe(7);
    expect(metrics.completed).toBe(0);
    expect(metrics.cancelled).toBe(0);
  });

  // AM-8: total is derived from groupBy, not from TRIP_STATUSES — no silent mismatch
  it("AM-8: total matches sum of all status counts (including EXCEPTION)", async () => {
    mockGroupBy.mockResolvedValue([
      { status: "ASSIGNED", _count: 1 },
      { status: "IN_TRANSIT", _count: 2 },
      { status: "EXCEPTION", _count: 3 },
      { status: "COMPLETED", _count: 4 },
      { status: "CANCELLED", _count: 5 },
    ]);

    const metrics = await getTripMetrics();

    expect(metrics.total).toBe(1 + 2 + 3 + 4 + 5);
  });

  // AM-9: byStatus is zero-filled for all TRIP_STATUSES, not just those in the DB result
  it("AM-9: byStatus has an entry for every status in TRIP_STATUSES", async () => {
    mockGroupBy.mockResolvedValue([{ status: "ASSIGNED", _count: 1 }]);

    const metrics = await getTripMetrics();

    for (const status of TRIP_STATUSES) {
      expect(metrics.byStatus).toHaveProperty(status);
      expect(typeof metrics.byStatus[status]).toBe("number");
    }
  });
});
