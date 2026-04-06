/**
 * Tests for lib/notificationRoutes.ts (Item 18 / G18-1..G18-4)
 *
 * Verifies that every NotificationType in lib/notifications.ts resolves
 * to a non-null route for at least one role with sensible metadata.
 *
 * Catches the regression where 17 notification types were emitted by the
 * backend but had no routing case in the UI — clicking them did nothing.
 */

import { getNotificationRoute } from "@/lib/notificationRoutes";
import { NotificationType } from "@/lib/notifications";

const ALL_TYPES = Object.values(NotificationType) as string[];

// Notification types that have no UI navigation target by design
// (e.g. background events, audit-only). Keep this list explicit so a
// future addition forces the developer to think about routing.
const NO_ROUTE_BY_DESIGN = new Set<string>([
  // none currently — every type defined in notifications.ts must route somewhere
]);

const FAT_METADATA = {
  loadId: "load-1",
  tripId: "trip-1",
  truckId: "truck-1",
  proposalId: "prop-1",
  escalationId: "esc-1",
  loadRequestId: "lr-1",
  requestId: "req-1",
  disputeId: "disp-1",
  settlementId: "set-1",
  depositId: "dep-1",
  savedSearchId: "ss-1",
  conversationId: "conv-1",
};

const ROLES = ["SHIPPER", "CARRIER", "DISPATCHER", "ADMIN"] as const;

describe("lib/notificationRoutes — getNotificationRoute()", () => {
  it("returns a string or null (never undefined)", () => {
    for (const type of ALL_TYPES) {
      for (const role of ROLES) {
        const result = getNotificationRoute(type, role, FAT_METADATA);
        expect(result === null || typeof result === "string").toBe(true);
      }
    }
  });

  it("every NotificationType resolves to a non-null route for at least one role", () => {
    const orphans: string[] = [];
    for (const type of ALL_TYPES) {
      if (NO_ROUTE_BY_DESIGN.has(type)) continue;
      const anyRoleResolves = ROLES.some(
        (role) => getNotificationRoute(type, role, FAT_METADATA) !== null
      );
      if (!anyRoleResolves) orphans.push(type);
    }
    expect(orphans).toEqual([]);
  });

  it("dispute types route to disputeId-scoped pages", () => {
    expect(
      getNotificationRoute("DISPUTE_FILED", "SHIPPER", { disputeId: "d1" })
    ).toBe("/shipper/disputes/d1");
    expect(
      getNotificationRoute("DISPUTE_RESOLVED", "ADMIN", { disputeId: "d1" })
    ).toBe("/admin/disputes/d1");
  });

  it("saved-search match routes to role-specific loadboard with searchId", () => {
    expect(
      getNotificationRoute("SAVED_SEARCH_MATCH", "CARRIER", {
        savedSearchId: "s1",
      })
    ).toBe("/carrier/loads?searchId=s1");
    expect(
      getNotificationRoute("SAVED_SEARCH_MATCH", "SHIPPER", {
        savedSearchId: "s1",
      })
    ).toBe("/shipper/loadboard?searchId=s1");
  });

  it("DEPOSIT_REQUESTED routes admin to wallet-deposits page", () => {
    expect(getNotificationRoute("DEPOSIT_REQUESTED", "ADMIN", {})).toBe(
      "/admin/wallet-deposits"
    );
    expect(getNotificationRoute("DEPOSIT_REQUESTED", "SHIPPER", {})).toBeNull();
  });

  it("insurance lifecycle routes to documents page per role", () => {
    expect(getNotificationRoute("INSURANCE_EXPIRING_SOON", "CARRIER", {})).toBe(
      "/carrier/documents"
    );
    expect(getNotificationRoute("INSURANCE_EXPIRED", "SHIPPER", {})).toBe(
      "/shipper/documents"
    );
  });

  it("NEW_MESSAGE routes to trip messages tab", () => {
    expect(
      getNotificationRoute("NEW_MESSAGE", "SHIPPER", { tripId: "t1" })
    ).toBe("/shipper/trips/t1?tab=messages");
    expect(
      getNotificationRoute("NEW_MESSAGE", "CARRIER", { loadId: "l1" })
    ).toBe("/carrier/trips/l1?tab=messages");
  });

  it("rating notifications route to trip detail when entityId present", () => {
    expect(
      getNotificationRoute("RATING_REQUESTED", "SHIPPER", { tripId: "t1" })
    ).toBe("/shipper/trips/t1");
    expect(
      getNotificationRoute("RATING_RECEIVED", "CARRIER", { tripId: "t1" })
    ).toBe("/carrier/trips/t1");
  });

  it("GPS_NO_DATA routes carrier to active trip", () => {
    expect(
      getNotificationRoute("GPS_NO_DATA", "CARRIER", { loadId: "l1" })
    ).toBe("/carrier/trips/l1");
  });

  it("REQUEST_REJECTED routes by role", () => {
    expect(getNotificationRoute("REQUEST_REJECTED", "CARRIER", {})).toBe(
      "/carrier/requests"
    );
    expect(getNotificationRoute("REQUEST_REJECTED", "SHIPPER", {})).toBe(
      "/shipper/requests"
    );
  });

  it("PARTIAL_FEE_COLLECTION routes to wallet", () => {
    expect(getNotificationRoute("PARTIAL_FEE_COLLECTION", "CARRIER", {})).toBe(
      "/carrier/wallet"
    );
    expect(getNotificationRoute("PARTIAL_FEE_COLLECTION", "SHIPPER", {})).toBe(
      "/shipper/wallet"
    );
  });

  it("unknown type returns null", () => {
    expect(getNotificationRoute("MADE_UP_TYPE", "SHIPPER", {})).toBeNull();
  });

  it("handles missing metadata gracefully", () => {
    for (const type of ALL_TYPES) {
      for (const role of ROLES) {
        // Should not throw on null/undefined metadata
        expect(() => getNotificationRoute(type, role, null)).not.toThrow();
        expect(() => getNotificationRoute(type, role, undefined)).not.toThrow();
      }
    }
  });
});
