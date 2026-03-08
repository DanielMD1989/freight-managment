/**
 * Tests for notification routing — all notification types and edge cases
 */
import { getNotificationRoute } from "../../src/utils/notificationRouting";

describe("Notification Routing", () => {
  // ---- Shipper routes ----

  describe("shipper routes", () => {
    const role = "SHIPPER";

    it("LOAD_ASSIGNED with tripId → /(shipper)/trips/:tripId", () => {
      expect(
        getNotificationRoute("LOAD_ASSIGNED", { tripId: "trip-1" }, role)
      ).toBe("/(shipper)/trips/trip-1");
    });

    it("LOAD_ASSIGNED without tripId → null", () => {
      expect(getNotificationRoute("LOAD_ASSIGNED", {}, role)).toBeNull();
    });

    it("LOAD_STATUS_CHANGE with tripId → /(shipper)/trips/:tripId", () => {
      expect(
        getNotificationRoute("LOAD_STATUS_CHANGE", { tripId: "trip-2" }, role)
      ).toBe("/(shipper)/trips/trip-2");
    });

    it("POD_SUBMITTED with tripId → /(shipper)/trips/:tripId", () => {
      expect(
        getNotificationRoute("POD_SUBMITTED", { tripId: "trip-3" }, role)
      ).toBe("/(shipper)/trips/trip-3");
    });

    it("TRUCK_REQUEST → /(shipper)/requests", () => {
      expect(getNotificationRoute("TRUCK_REQUEST", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("TRUCK_REQUEST_APPROVED → /(shipper)/requests", () => {
      expect(getNotificationRoute("TRUCK_REQUEST_APPROVED", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("TRUCK_REQUEST_REJECTED → /(shipper)/requests", () => {
      expect(getNotificationRoute("TRUCK_REQUEST_REJECTED", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("LOAD_REQUEST → /(shipper)/requests", () => {
      expect(getNotificationRoute("LOAD_REQUEST", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("LOAD_REQUEST_RECEIVED → /(shipper)/requests (G-A9-1)", () => {
      expect(getNotificationRoute("LOAD_REQUEST_RECEIVED", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("LOAD_REQUEST_APPROVED → /(shipper)/requests", () => {
      expect(getNotificationRoute("LOAD_REQUEST_APPROVED", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("LOAD_REQUEST_REJECTED → /(shipper)/requests", () => {
      expect(getNotificationRoute("LOAD_REQUEST_REJECTED", {}, role)).toBe(
        "/(shipper)/requests"
      );
    });

    it("NEW_LOAD_MATCHING → /(shipper)/matches", () => {
      expect(getNotificationRoute("NEW_LOAD_MATCHING", {}, role)).toBe(
        "/(shipper)/matches"
      );
    });

    it("PAYMENT_RECEIVED → /(shipper)/wallet", () => {
      expect(getNotificationRoute("PAYMENT_RECEIVED", {}, role)).toBe(
        "/(shipper)/wallet"
      );
    });

    it("PAYMENT_PENDING → /(shipper)/wallet", () => {
      expect(getNotificationRoute("PAYMENT_PENDING", {}, role)).toBe(
        "/(shipper)/wallet"
      );
    });

    it("GPS_OFFLINE → /(shipper)/map", () => {
      expect(getNotificationRoute("GPS_OFFLINE", {}, role)).toBe(
        "/(shipper)/map"
      );
    });

    it("GPS_ONLINE → /(shipper)/map", () => {
      expect(getNotificationRoute("GPS_ONLINE", {}, role)).toBe(
        "/(shipper)/map"
      );
    });

    it("GEOFENCE_ALERT → /(shipper)/map", () => {
      expect(getNotificationRoute("GEOFENCE_ALERT", {}, role)).toBe(
        "/(shipper)/map"
      );
    });

    it("EXCEPTION_REPORTED with tripId → /(shipper)/trips/:tripId", () => {
      expect(
        getNotificationRoute("EXCEPTION_REPORTED", { tripId: "trip-5" }, role)
      ).toBe("/(shipper)/trips/trip-5");
    });

    it("EXCEPTION_REPORTED without tripId → /(shipper)/trips", () => {
      expect(getNotificationRoute("EXCEPTION_REPORTED", {}, role)).toBe(
        "/(shipper)/trips"
      );
    });
  });

  // ---- Carrier routes (verify role switching) ----

  describe("carrier routes", () => {
    const role = "CARRIER";

    it("LOAD_ASSIGNED with tripId → /(carrier)/trips/:tripId", () => {
      expect(
        getNotificationRoute("LOAD_ASSIGNED", { tripId: "trip-1" }, role)
      ).toBe("/(carrier)/trips/trip-1");
    });

    it("TRUCK_REQUEST → /(carrier)/requests", () => {
      expect(getNotificationRoute("TRUCK_REQUEST", {}, role)).toBe(
        "/(carrier)/requests"
      );
    });

    // G-A8-1: notifyTruckRequest() emits "TRUCK_REQUEST_RECEIVED" (not "TRUCK_REQUEST").
    // Carrier must be deep-linked to /(carrier)/requests on tap.
    it("TRUCK_REQUEST_RECEIVED → /(carrier)/requests", () => {
      expect(getNotificationRoute("TRUCK_REQUEST_RECEIVED", {}, role)).toBe(
        "/(carrier)/requests"
      );
    });

    it("LOAD_REQUEST_RECEIVED → /(carrier)/requests (G-A9-1)", () => {
      expect(getNotificationRoute("LOAD_REQUEST_RECEIVED", {}, role)).toBe(
        "/(carrier)/requests"
      );
    });

    it("GPS_OFFLINE → /(carrier)/map", () => {
      expect(getNotificationRoute("GPS_OFFLINE", {}, role)).toBe(
        "/(carrier)/map"
      );
    });

    it("EXCEPTION_REPORTED without tripId → /(carrier)/trips", () => {
      expect(getNotificationRoute("EXCEPTION_REPORTED", {}, role)).toBe(
        "/(carrier)/trips"
      );
    });
  });

  // ---- Registration & approval routes (G-N1-7, G-N1-8, G-N1-9) ----

  describe("registration & approval routes", () => {
    // NA-9: ACCOUNT_APPROVED routes to carrier dashboard for CARRIER
    it("NA-9: ACCOUNT_APPROVED → /(carrier)/dashboard for CARRIER", () => {
      expect(getNotificationRoute("ACCOUNT_APPROVED", {}, "CARRIER")).toBe(
        "/(carrier)/dashboard"
      );
    });

    it("NA-9b: ACCOUNT_APPROVED → /(shipper)/dashboard for SHIPPER", () => {
      expect(getNotificationRoute("ACCOUNT_APPROVED", {}, "SHIPPER")).toBe(
        "/(shipper)/dashboard"
      );
    });

    it("NA-9c: ACCOUNT_APPROVED → /(dispatcher)/dashboard for DISPATCHER", () => {
      expect(getNotificationRoute("ACCOUNT_APPROVED", {}, "DISPATCHER")).toBe(
        "/(dispatcher)/dashboard"
      );
    });

    // NA-10: ACCOUNT_FLAGGED routes to profile for CARRIER (not null)
    it("NA-10: ACCOUNT_FLAGGED → /(carrier)/profile for CARRIER (not null)", () => {
      expect(getNotificationRoute("ACCOUNT_FLAGGED", {}, "CARRIER")).toBe(
        "/(carrier)/profile"
      );
    });

    it("NA-10b: ACCOUNT_FLAGGED → /(shipper)/profile for SHIPPER (not null)", () => {
      expect(getNotificationRoute("ACCOUNT_FLAGGED", {}, "SHIPPER")).toBe(
        "/(shipper)/profile"
      );
    });

    it("NA-10c: ACCOUNT_FLAGGED → /(admin)/users for ADMIN", () => {
      expect(getNotificationRoute("ACCOUNT_FLAGGED", {}, "ADMIN")).toBe(
        "/(admin)/users"
      );
    });

    // NA-11: USER_STATUS_CHANGED routes to /(shared)/profile
    it("NA-11: USER_STATUS_CHANGED → /(shared)/profile for any role", () => {
      expect(getNotificationRoute("USER_STATUS_CHANGED", {}, "CARRIER")).toBe(
        "/(shared)/profile"
      );
      expect(getNotificationRoute("USER_STATUS_CHANGED", {}, "SHIPPER")).toBe(
        "/(shared)/profile"
      );
    });

    // NA-12: DOCUMENTS_SUBMITTED routes to /(admin)/verification for ADMIN
    it("NA-12: DOCUMENTS_SUBMITTED → /(admin)/verification for ADMIN", () => {
      expect(getNotificationRoute("DOCUMENTS_SUBMITTED", {}, "ADMIN")).toBe(
        "/(admin)/verification"
      );
    });

    it("NA-12b: DOCUMENTS_SUBMITTED → null for non-admin", () => {
      expect(
        getNotificationRoute("DOCUMENTS_SUBMITTED", {}, "CARRIER")
      ).toBeNull();
      expect(
        getNotificationRoute("DOCUMENTS_SUBMITTED", {}, "SHIPPER")
      ).toBeNull();
    });

    it("REGISTRATION_RESUBMITTED → /(admin)/verification for ADMIN", () => {
      expect(
        getNotificationRoute("REGISTRATION_RESUBMITTED", {}, "ADMIN")
      ).toBe("/(admin)/verification");
    });

    it("TRUCK_RESUBMITTED → /(admin)/verification for ADMIN", () => {
      expect(getNotificationRoute("TRUCK_RESUBMITTED", {}, "ADMIN")).toBe(
        "/(admin)/verification"
      );
    });

    it("TRUCK_RESUBMITTED → null for non-admin", () => {
      expect(
        getNotificationRoute("TRUCK_RESUBMITTED", {}, "CARRIER")
      ).toBeNull();
    });

    it("BYPASS_WARNING still routes to /(admin)/users (not affected by ACCOUNT_FLAGGED split)", () => {
      expect(getNotificationRoute("BYPASS_WARNING", {}, "ADMIN")).toBe(
        "/(admin)/users"
      );
      expect(getNotificationRoute("BYPASS_WARNING", {}, "CARRIER")).toBeNull();
    });
  });

  // ---- Shared / null routes ----

  describe("shared and null routes", () => {
    it("RATING_RECEIVED → /(shared)/profile (same for all roles)", () => {
      expect(getNotificationRoute("RATING_RECEIVED", {}, "SHIPPER")).toBe(
        "/(shared)/profile"
      );
      expect(getNotificationRoute("RATING_RECEIVED", {}, "CARRIER")).toBe(
        "/(shared)/profile"
      );
    });

    it("USER_SUSPENDED → null", () => {
      expect(getNotificationRoute("USER_SUSPENDED", {}, "SHIPPER")).toBeNull();
    });

    it("MARKETING → null", () => {
      expect(getNotificationRoute("MARKETING", {}, "SHIPPER")).toBeNull();
    });

    it("SYSTEM → null", () => {
      expect(getNotificationRoute("SYSTEM", {}, "SHIPPER")).toBeNull();
    });

    it("unknown type → null", () => {
      expect(
        getNotificationRoute("NONEXISTENT_TYPE", {}, "SHIPPER")
      ).toBeNull();
    });

    it("undefined type → null", () => {
      expect(getNotificationRoute(undefined, {}, "SHIPPER")).toBeNull();
    });
  });
});
