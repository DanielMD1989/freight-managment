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
    expect(status).toBe(201);

    const proposal = data.proposal ?? data.matchProposal ?? data;
    expect(proposal.id).toBeDefined();
  });

  test("dispatcher cannot accept load request on behalf of shipper — returns 403/404", async () => {
    test.setTimeout(180000);
    const dispatcherToken = await getDispatcherToken();
    const shipperToken = await getShipperToken();
    const carrierToken = await getCarrierToken();
    const adminToken = await getAdminToken();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    // Create a fresh load for this test
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
        status: "POSTED",
      }
    );
    const testLoadId = (freshLoad.load ?? freshLoad).id;

    // Create a fresh dedicated truck so we don't depend on DB state
    const dispPlate = `BP-D403-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const { data: truckCreated } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: dispPlate,
        capacity: 15000,
        volume: 50,
        currentCity: "Addis Ababa",
        currentRegion: "Addis Ababa",
        isAvailable: true,
      }
    );
    const testTruckId = (truckCreated.truck ?? truckCreated).id;
    if (!testTruckId) {
      test.skip(true, "Could not create fresh truck for dispatcher-403 test");
      return;
    }
    await apiCall("POST", `/api/trucks/${testTruckId}/approve`, adminToken, {
      action: "APPROVE",
    });

    // Create an active truck posting (required by load-requests endpoint)
    // Fetch a city ID from ethiopian-locations (required by truck-postings schema)
    const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations`);
    const locData = await locRes.json();
    const allLocs: Array<{ id: string }> =
      locData.locations ?? locData.cities ?? locData ?? [];
    const originCityId = allLocs[0]?.id;
    if (!originCityId) {
      test.skip(true, "Could not fetch city ID for truck posting");
      return;
    }
    const postingFrom = new Date();
    postingFrom.setDate(postingFrom.getDate() + 1);
    const { status: postingStatus } = await apiCall(
      "POST",
      "/api/truck-postings",
      carrierToken,
      {
        truckId: testTruckId,
        originCityId,
        availableFrom: postingFrom.toISOString(),
        contactName: "BP Dispatcher 403 Test",
        contactPhone: "+251912000099",
      }
    );
    if (postingStatus !== 201) {
      test.skip(true, `Could not create truck posting (${postingStatus})`);
      return;
    }

    // Carrier creates a load request
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

    // Dispatcher tries to respond on behalf of shipper.
    // API returns 404 (security: Fix 6b — 404 instead of 403 to prevent resource existence leakage).
    // Accept both 403 and 404 — either correctly signals forbidden access.
    const { status } = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      dispatcherToken,
      { action: "APPROVE" }
    );
    expect([403, 404]).toContain(status);
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
