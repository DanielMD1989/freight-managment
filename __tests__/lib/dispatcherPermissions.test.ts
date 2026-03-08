/**
 * Dispatcher Permissions Unit Tests — Round U2-FULL
 *
 * Pure function unit tests for lib/dispatcherPermissions.ts.
 * No mocks, no DB, no jest.setup.js infrastructure needed.
 *
 * Tests DP-1 to DP-28.
 */

import {
  canViewAllLoads,
  canViewAllTrucks,
  canAssignLoads,
  canProposeMatch,
  canApproveRequests,
  canRequestTruck,
  canUpdateLoadStatus,
  canAccessGpsTracking,
  canManageTrucks,
  getDispatcherPermissions,
} from "@/lib/dispatcherPermissions";

// Helper to build a minimal DispatcherUser fixture
function user(
  role: string,
  organizationId?: string
): { role: any; organizationId?: string; userId: string } {
  return { role: role as any, organizationId, userId: `${role}-uid` };
}

// ─── canViewAllLoads ──────────────────────────────────────────────────────────

describe("canViewAllLoads", () => {
  it("DP-1 — DISPATCHER → true", () => {
    expect(canViewAllLoads(user("DISPATCHER"))).toBe(true);
  });

  it("DP-2 — ADMIN and SUPER_ADMIN → true", () => {
    expect(canViewAllLoads(user("ADMIN"))).toBe(true);
    expect(canViewAllLoads(user("SUPER_ADMIN"))).toBe(true);
  });

  it("DP-3 — SHIPPER and CARRIER → false", () => {
    expect(canViewAllLoads(user("SHIPPER"))).toBe(false);
    expect(canViewAllLoads(user("CARRIER"))).toBe(false);
  });
});

// ─── canViewAllTrucks ─────────────────────────────────────────────────────────

describe("canViewAllTrucks", () => {
  it("DP-4 — DISPATCHER → true", () => {
    expect(canViewAllTrucks(user("DISPATCHER"))).toBe(true);
  });

  it("DP-5 — ADMIN and SUPER_ADMIN → true", () => {
    expect(canViewAllTrucks(user("ADMIN"))).toBe(true);
    expect(canViewAllTrucks(user("SUPER_ADMIN"))).toBe(true);
  });

  it("DP-6 — SHIPPER and CARRIER → false", () => {
    expect(canViewAllTrucks(user("SHIPPER"))).toBe(false);
    expect(canViewAllTrucks(user("CARRIER"))).toBe(false);
  });
});

// ─── canAssignLoads ───────────────────────────────────────────────────────────

describe("canAssignLoads", () => {
  it("DP-7 — DISPATCHER → false (propose-only rule)", () => {
    expect(canAssignLoads(user("DISPATCHER"))).toBe(false);
  });

  it("DP-8 — ADMIN → true", () => {
    expect(canAssignLoads(user("ADMIN"))).toBe(true);
  });

  it("DP-9 — CARRIER → true (carrier is final authority)", () => {
    expect(canAssignLoads(user("CARRIER", "carrier-org-1"))).toBe(true);
  });

  it("DP-10 — SHIPPER → false (shippers request, not assign)", () => {
    expect(canAssignLoads(user("SHIPPER", "shipper-org-1"))).toBe(false);
  });
});

// ─── canProposeMatch ──────────────────────────────────────────────────────────

describe("canProposeMatch", () => {
  it("DP-11 — DISPATCHER → true", () => {
    expect(canProposeMatch(user("DISPATCHER"))).toBe(true);
  });

  it("DP-12 — ADMIN → true", () => {
    expect(canProposeMatch(user("ADMIN"))).toBe(true);
  });

  it("DP-13 — SHIPPER and CARRIER → false", () => {
    expect(canProposeMatch(user("SHIPPER"))).toBe(false);
    expect(canProposeMatch(user("CARRIER"))).toBe(false);
  });
});

// ─── canApproveRequests ───────────────────────────────────────────────────────

describe("canApproveRequests", () => {
  it("DP-14 — DISPATCHER → false (not a carrier)", () => {
    expect(canApproveRequests(user("DISPATCHER"), "carrier-org-1")).toBe(false);
  });

  it("DP-15 — CARRIER owning the truck org → true", () => {
    const carrier = user("CARRIER", "carrier-org-1");
    expect(canApproveRequests(carrier, "carrier-org-1")).toBe(true);
  });

  it("DP-16 — CARRIER with wrong org → false", () => {
    const carrier = user("CARRIER", "carrier-org-1");
    expect(canApproveRequests(carrier, "carrier-org-99")).toBe(false);
  });

  it("DP-17 — ADMIN → true", () => {
    expect(canApproveRequests(user("ADMIN"), "any-org")).toBe(true);
  });
});

// ─── canRequestTruck ──────────────────────────────────────────────────────────

describe("canRequestTruck", () => {
  it("DP-18 — SHIPPER requesting their own load → true", () => {
    const shipper = user("SHIPPER", "shipper-org-1");
    expect(canRequestTruck(shipper, "shipper-org-1")).toBe(true);
  });

  it("DP-19 — SHIPPER requesting wrong load → false", () => {
    const shipper = user("SHIPPER", "shipper-org-1");
    expect(canRequestTruck(shipper, "shipper-org-99")).toBe(false);
  });

  it("DP-20 — DISPATCHER → false (cannot request trucks)", () => {
    expect(canRequestTruck(user("DISPATCHER"), "shipper-org-1")).toBe(false);
  });
});

// ─── canUpdateLoadStatus ──────────────────────────────────────────────────────

describe("canUpdateLoadStatus", () => {
  it("DP-21 — DISPATCHER → true", () => {
    expect(canUpdateLoadStatus(user("DISPATCHER"))).toBe(true);
  });

  it("DP-22 — SHIPPER updating own load → true", () => {
    const shipper = user("SHIPPER", "shipper-org-1");
    expect(canUpdateLoadStatus(shipper, "shipper-org-1")).toBe(true);
  });

  it("DP-23 — CARRIER updating load assigned to their truck → true", () => {
    const carrier = user("CARRIER", "carrier-org-1");
    expect(canUpdateLoadStatus(carrier, undefined, "carrier-org-1")).toBe(true);
  });
});

// ─── canAccessGpsTracking ─────────────────────────────────────────────────────

describe("canAccessGpsTracking", () => {
  it("DP-24 — DISPATCHER → true", () => {
    expect(canAccessGpsTracking(user("DISPATCHER"))).toBe(true);
  });

  it("DP-25 — SHIPPER tracking own load → true", () => {
    const shipper = user("SHIPPER", "shipper-org-1");
    expect(canAccessGpsTracking(shipper, "shipper-org-1")).toBe(true);
  });

  it("DP-26 — CARRIER tracking their truck → true", () => {
    const carrier = user("CARRIER", "carrier-org-1");
    expect(canAccessGpsTracking(carrier, undefined, "carrier-org-1")).toBe(
      true
    );
  });
});

// ─── canManageTrucks ──────────────────────────────────────────────────────────

describe("canManageTrucks", () => {
  it("DP-27 — DISPATCHER → false, CARRIER own → true, ADMIN → true", () => {
    expect(canManageTrucks(user("DISPATCHER"))).toBe(false);
    const carrier = user("CARRIER", "carrier-org-1");
    expect(canManageTrucks(carrier, "carrier-org-1")).toBe(true);
    expect(canManageTrucks(user("ADMIN"))).toBe(true);
  });
});

// ─── getDispatcherPermissions ────────────────────────────────────────────────

describe("getDispatcherPermissions", () => {
  it("DP-28 — DISPATCHER summary has canAssignLoads:false, canProposeMatch:true, isDispatcher:true", () => {
    const dispatcher = user("DISPATCHER");
    const perms = getDispatcherPermissions(dispatcher);
    expect(perms.canAssignLoads).toBe(false);
    expect(perms.canProposeMatch).toBe(true);
    expect(perms.isDispatcher).toBe(true);
    expect(perms.canViewAllLoads).toBe(true);
    expect(perms.canViewAllTrucks).toBe(true);
  });
});
