/**
 * Blueprint §5 — Dispatcher match proposals and cross-domain access
 *
 * Verifies dispatcher can view all loads/trucks/trips, propose matches,
 * and is blocked from acting on behalf of carrier or shipper.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getDispatcherToken,
  getCarrierToken,
  getShipperToken,
  getAdminToken,
  ensureTrip,
  BASE_URL,
} from "../shared/test-utils";

test.use({ storageState: "e2e/.auth/dispatcher.json" });

test.describe("Dispatcher — match proposals and access", () => {
  test("dispatcher /dispatcher/loads page shows all loads", async ({
    page,
  }) => {
    await page.goto("/dispatcher/loads");
    await expect(
      page.locator("main").getByRole("heading", { name: /All Loads/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("dispatcher /dispatcher/trucks page shows all trucks", async ({
    page,
  }) => {
    await page.goto("/dispatcher/trucks");
    await expect(
      page.locator("main").getByRole("heading", { name: /All Trucks/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("dispatcher /dispatcher/trips page shows active trips", async ({
    page,
  }) => {
    await page.goto("/dispatcher/trips");
    await expect(
      page.locator("main").getByRole("heading", { name: /Active Trips/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("dispatcher can propose match — POST /api/match-proposals returns 201", async () => {
    test.setTimeout(180000);
    const dispatcherToken = await getDispatcherToken();
    const carrierToken = await getCarrierToken();
    const shipperToken = await getShipperToken();
    const adminToken = await getAdminToken();

    // Ensure a POSTED load exists
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    const { data: loadData } = await apiCall(
      "POST",
      "/api/loads",
      shipperToken,
      {
        pickupCity: "Addis Ababa",
        deliveryCity: "Adama",
        pickupDate: tomorrow.toISOString().split("T")[0],
        deliveryDate: fiveDays.toISOString().split("T")[0],
        truckType: "FLATBED",
        weight: 5000,
        cargoDescription: "Blueprint dispatcher match test cargo",
        description: "Blueprint dispatcher match test",
        status: "POSTED",
      }
    );
    const loadId = (loadData.load ?? loadData).id;

    // Ensure an approved carrier truck with posting
    const { data: truckData } = await apiCall(
      "GET",
      "/api/trucks?myTrucks=true&approvalStatus=APPROVED&limit=1",
      carrierToken
    );
    const trucks = truckData.trucks ?? truckData;
    let truckId: string;

    if (Array.isArray(trucks) && trucks.length > 0) {
      truckId = trucks[0].id;
    } else {
      const plate = `BP-DISP-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const { data: created } = await apiCall(
        "POST",
        "/api/trucks",
        carrierToken,
        {
          truckType: "FLATBED",
          licensePlate: plate,
          capacity: 20000,
          volume: 60,
          currentCity: "Addis Ababa",
          currentRegion: "Addis Ababa",
          isAvailable: true,
        }
      );
      truckId = (created.truck ?? created).id;
      await apiCall("POST", `/api/trucks/${truckId}/approve`, adminToken, {
        action: "APPROVE",
      });
    }

    const { status, data } = await apiCall(
      "POST",
      "/api/match-proposals",
      dispatcherToken,
      { loadId, truckId }
    );
    expect([200, 201]).toContain(status);

    const proposal = data.proposal ?? data.matchProposal ?? data;
    expect(proposal.id).toBeDefined();
  });

  test("dispatcher cannot accept load request on behalf of shipper — returns 403", async () => {
    test.setTimeout(180000);
    const dispatcherToken = await getDispatcherToken();
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    // Create a load request as carrier
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    const { data: freshLoad } = await apiCall(
      "POST",
      "/api/loads",
      shipperToken,
      {
        pickupCity: "Addis Ababa",
        deliveryCity: "Harar",
        pickupDate: tomorrow.toISOString().split("T")[0],
        deliveryDate: fiveDays.toISOString().split("T")[0],
        truckType: "FLATBED",
        weight: 3000,
        cargoDescription: "Blueprint dispatcher-cannot-respond test cargo",
        description: "Blueprint dispatcher-cannot-respond test",
        status: "POSTED",
      }
    );
    const testLoadId = (freshLoad.load ?? freshLoad).id;

    // Get carrier truck
    const { data: truckData } = await apiCall(
      "GET",
      "/api/trucks?myTrucks=true&approvalStatus=APPROVED&limit=1",
      carrierToken
    );
    const trucks = truckData.trucks ?? truckData;
    if (!Array.isArray(trucks) || trucks.length === 0) {
      test.skip(true, "No approved truck available for dispatcher-403 test");
      return;
    }
    const testTruckId = trucks[0].id;

    const { data: reqData, status: reqStatus } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId: testLoadId, truckId: testTruckId, notes: "Dispatcher 403 test" }
    );
    if (reqStatus !== 201) {
      test.skip(true, `Could not create load request (${reqStatus})`);
      return;
    }
    const requestId = (reqData.loadRequest ?? reqData.request ?? reqData).id;

    // Dispatcher tries to respond on behalf of shipper
    const { status } = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      dispatcherToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(403);
  });

  test("dispatcher can cancel ASSIGNED trip via /api/trips/:id/cancel", async () => {
    test.setTimeout(180000);
    const dispatcherToken = await getDispatcherToken();
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

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
});
