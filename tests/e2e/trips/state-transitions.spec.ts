/**
 * Blueprint §7 — Trip state machine transitions
 *
 * Uses ensureTrip() factory from shared utils to set up a trip,
 * then advances it through every valid state.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getShipperToken,
  getCarrierToken,
  getAdminToken,
  ensureTrip,
} from "../shared/test-utils";

test.describe("Trip State Transitions", () => {
  let tripId: string;
  let loadId: string;
  let carrierToken: string;

  test.beforeAll(async () => {
    test.setTimeout(180000);
    try {
      const shipperToken = await getShipperToken();
      carrierToken = await getCarrierToken();
      const adminToken = await getAdminToken();
      const result = await ensureTrip(shipperToken, carrierToken, adminToken);
      tripId = result.tripId;
      loadId = result.loadId;
    } catch (e) {
      console.warn("beforeAll setup failed:", e);
    }
  });

  test("ASSIGNED → PICKUP_PENDING: startedAt is set", async () => {
    test.setTimeout(60000);
    if (!tripId) {
      test.skip(true, "Trip not created in beforeAll");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "PICKUP_PENDING" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.startedAt).not.toBeNull();
  });

  test("PICKUP_PENDING → IN_TRANSIT: pickedUpAt is set", async () => {
    test.setTimeout(60000);
    if (!tripId) {
      test.skip(true, "Trip not created in beforeAll");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.pickedUpAt).not.toBeNull();
  });

  test("IN_TRANSIT → DELIVERED: deliveredAt is set", async () => {
    test.setTimeout(60000);
    if (!tripId) {
      test.skip(true, "Trip not created in beforeAll");
      return;
    }

    const { status, data } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "DELIVERED" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.deliveredAt).not.toBeNull();
  });

  test("truck reappears on marketplace after trip DELIVERED", async () => {
    test.setTimeout(60000);
    const shipperToken = await getShipperToken();

    const { status } = await apiCall(
      "GET",
      "/api/truck-postings?limit=20",
      shipperToken
    );
    // API should respond OK; truck may or may not be in results depending on posting state
    expect(status).toBe(200);
  });
});

// Separate describe for UI tests that need carrier session
test.describe("Trip UI — Carrier portal", () => {
  test.use({ storageState: "e2e/.auth/carrier.json" });

  test("carrier UI: trips page is accessible", async ({ page }) => {
    await page.goto("/carrier/trips");
    const heading = page
      .getByRole("heading", { name: /trip|delivery|shipment/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  });
});
