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
