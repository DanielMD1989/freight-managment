/**
 * Blueprint §7 — Trip EXCEPTION state and resolution
 *
 * Admin can move IN_TRANSIT to EXCEPTION and resolve it.
 * Carrier can raise EXCEPTION. Dispatcher cannot resolve.
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

test.describe("Trip Exception Path", () => {
  async function buildInTransitTrip() {
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();
    const { tripId } = await ensureTrip(shipperToken, carrierToken, adminToken);

    await apiCall("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "PICKUP_PENDING",
    });
    await apiCall("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "IN_TRANSIT",
    });

    return { tripId, carrierToken, adminToken };
  }

  test("admin moves IN_TRANSIT trip to EXCEPTION", async () => {
    test.setTimeout(180000);
    const { tripId, adminToken } = await buildInTransitTrip();

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      adminToken,
      {
        status: "EXCEPTION",
        exceptionNote: "Admin EXCEPTION raise — blueprint test",
      }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("EXCEPTION");
  });

  test("admin resolves EXCEPTION → IN_TRANSIT (valid target)", async () => {
    test.setTimeout(180000);
    const { tripId, adminToken } = await buildInTransitTrip();

    await apiCall("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "EXCEPTION",
      exceptionNote: "Raise for resolution test",
    });

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      adminToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("IN_TRANSIT");
  });

  test("admin resolves EXCEPTION → ASSIGNED (valid target)", async () => {
    test.setTimeout(180000);
    const { tripId, adminToken } = await buildInTransitTrip();

    await apiCall("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "EXCEPTION",
      exceptionNote: "Raise for ASSIGNED resolution test",
    });

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      adminToken,
      { status: "ASSIGNED" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("ASSIGNED");
  });

  test("carrier raises EXCEPTION from IN_TRANSIT — returns 200", async () => {
    test.setTimeout(180000);
    const { tripId, carrierToken } = await buildInTransitTrip();

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      {
        status: "EXCEPTION",
        exceptionNote: "Carrier raises exception — blueprint",
      }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.status).toBe("EXCEPTION");
  });

  test("carrier cannot resolve EXCEPTION — returns 403", async () => {
    test.setTimeout(180000);
    const { tripId, carrierToken, adminToken } = await buildInTransitTrip();

    // Admin raises EXCEPTION
    await apiCall("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "EXCEPTION",
      exceptionNote: "Setup for carrier-cannot-resolve test",
    });

    // Carrier tries to resolve
    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(403);
  });

  test("dispatcher cannot resolve EXCEPTION — returns 403", async () => {
    test.setTimeout(180000);
    const { tripId, adminToken } = await buildInTransitTrip();
    const dispatcherToken = await getDispatcherToken();

    await apiCall("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "EXCEPTION",
      exceptionNote: "Setup for dispatcher-cannot-resolve test",
    });

    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      dispatcherToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(403);
  });
});
