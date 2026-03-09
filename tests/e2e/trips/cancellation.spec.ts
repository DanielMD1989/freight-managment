/**
 * Blueprint §7 — Trip cancellation rules
 *
 * Carrier/dispatcher can cancel ASSIGNED trips.
 * IN_TRANSIT → CANCELLED directly is blocked (must go through EXCEPTION).
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getShipperToken,
  getCarrierToken,
  getAdminToken,
  getDispatcherToken,
  ensureTrip,
} from "../shared/test-utils";

test.describe("Trip Cancellation", () => {
  test("carrier can cancel ASSIGNED trip via /api/trips/:id/cancel", async () => {
    test.setTimeout(180000);
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    const { tripId } = await ensureTrip(shipperToken, carrierToken, adminToken);

    const { status, data } = await apiCall(
      "POST",
      `/api/trips/${tripId}/cancel`,
      carrierToken,
      { reason: "Blueprint cancellation test" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("CANCELLED");
  });

  test("dispatcher can cancel ASSIGNED trip via /api/trips/:id/cancel", async () => {
    test.setTimeout(180000);
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();
    const dispatcherToken = await getDispatcherToken();

    const { tripId } = await ensureTrip(shipperToken, carrierToken, adminToken);

    const { status, data } = await apiCall(
      "POST",
      `/api/trips/${tripId}/cancel`,
      dispatcherToken,
      { reason: "Blueprint dispatcher cancel test" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("CANCELLED");
  });

  test("IN_TRANSIT → CANCELLED directly is blocked — returns 400", async () => {
    test.setTimeout(180000);
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    const { tripId } = await ensureTrip(shipperToken, carrierToken, adminToken);

    // Advance to IN_TRANSIT
    await apiCall("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "PICKUP_PENDING",
    });
    await apiCall("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "IN_TRANSIT",
    });

    // Now try PATCH to CANCELLED directly — should be blocked
    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "CANCELLED" }
    );
    expect(status).toBe(400);
  });

  test("IN_TRANSIT → EXCEPTION → CANCELLED is the valid path", async () => {
    test.setTimeout(180000);
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    const { tripId } = await ensureTrip(shipperToken, carrierToken, adminToken);

    // Advance to IN_TRANSIT
    await apiCall("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "PICKUP_PENDING",
    });
    await apiCall("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "IN_TRANSIT",
    });

    // Carrier raises EXCEPTION
    const { status: excStatus } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "EXCEPTION", exceptionNote: "Blueprint exception path test" }
    );
    expect(excStatus).toBe(200);

    // Admin resolves to CANCELLED
    const { status: cancelStatus } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      adminToken,
      { status: "CANCELLED" }
    );
    expect(cancelStatus).toBe(200);
  });
});
