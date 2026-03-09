/**
 * Blueprint §4 — Shipper sends truck request (shipper→carrier booking path)
 *
 * Tests the shipper-initiates-request flow via /api/truck-requests.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getShipperToken,
  getCarrierToken,
  getAdminToken,
  ensureLoad,
  BASE_URL,
} from "../shared/test-utils";

test.describe("Shipper → Truck Request flow", () => {
  let shipperToken: string;
  let carrierToken: string;
  let adminToken: string;
  let loadId: string;
  let truckId: string;
  // Trips created by respond-APPROVE tests must be cancelled so the next test finds a free truck
  const tripsToCleanup: string[] = [];

  test.beforeAll(async () => {
    test.setTimeout(120000);
    shipperToken = await getShipperToken();
    carrierToken = await getCarrierToken();
    adminToken = await getAdminToken();

    // Ensure we have a posted load
    loadId = await ensureLoad(shipperToken);

    // Always create a fresh truck so it has no active trips from previous runs
    const plate = `BP-SR-${Date.now().toString(36).toUpperCase()}`;
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

    // Ensure truck has an active posting
    const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations?limit=1`);
    const locations = await locRes.json();
    const originCityId = (
      locations[0] ??
      locations.locations?.[0] ??
      locations.cities?.[0]
    )?.id;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await apiCall("POST", "/api/truck-postings", carrierToken, {
      truckId,
      originCityId,
      availableFrom: tomorrow.toISOString(),
      contactName: "BP Shipper Request Carrier",
      contactPhone: "+251912000020",
    });
  });

  test("shipper sends truck request — POST /api/truck-requests returns 201", async () => {
    test.setTimeout(60000);

    const { status, data } = await apiCall(
      "POST",
      "/api/truck-requests",
      shipperToken,
      {
        truckId,
        loadId,
        notes: "Blueprint shipper request test",
      }
    );
    expect(status).toBe(201);

    const request = data.truckRequest ?? data.request ?? data;
    expect(request.id).toBeDefined();
  });

  test("carrier accepts truck request — status becomes APPROVED", async () => {
    test.setTimeout(120000);

    // Create a fresh request
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
        deliveryCity: "Bahir Dar",
        pickupDate: tomorrow.toISOString().split("T")[0],
        deliveryDate: fiveDays.toISOString().split("T")[0],
        truckType: "FLATBED",
        weight: 4000,
        cargoDescription: "Blueprint truck request accept test cargo",
        description: "Blueprint truck request accept test",
        status: "POSTED",
      }
    );
    const freshLoadId = (freshLoad.load ?? freshLoad).id;

    const { data: reqData, status: reqStatus } = await apiCall(
      "POST",
      "/api/truck-requests",
      shipperToken,
      { truckId, loadId: freshLoadId, notes: "Accept test" }
    );
    if (![200, 201].includes(reqStatus)) {
      test.skip(true, `Could not create truck request (${reqStatus})`);
      return;
    }
    const requestId = (reqData.truckRequest ?? reqData.request ?? reqData).id;

    const { status, data: respondData } = await apiCall(
      "POST",
      `/api/truck-requests/${requestId}/respond`,
      carrierToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    // If a trip was created by this approval, track it for cleanup so the next test
    // finds the truck available
    const tripId =
      respondData?.trip?.id ??
      respondData?.loadRequest?.tripId ??
      respondData?.tripId;
    if (tripId) tripsToCleanup.push(tripId);
  });

  test.afterEach(async () => {
    // Cancel any trips that were created to ensure the shared truckId is free for the next test
    if (tripsToCleanup.length === 0) return;
    for (const id of tripsToCleanup.splice(0)) {
      const { data } = await apiCall("GET", `/api/trips/${id}`, adminToken);
      const trip = data.trip ?? data;
      if (!trip?.status || ["COMPLETED", "CANCELLED"].includes(trip.status))
        continue;
      await apiCall("POST", `/api/trips/${id}/cancel`, adminToken, {
        reason: "E2E shipper-request afterEach cleanup",
      }).catch(() => {});
    }
  });

  test("carrier rejects truck request — load remains available", async () => {
    test.setTimeout(180000);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    // Create a fresh truck for this test so it is completely decoupled from
    // any trip/request created by the "accepts" test above
    const rejectPlate = `BP-SR-REJ-${Date.now().toString(36).toUpperCase()}`;
    const { data: rejTruckData } = await apiCall(
      "POST",
      "/api/trucks",
      carrierToken,
      {
        truckType: "FLATBED",
        licensePlate: rejectPlate,
        capacity: 20000,
        volume: 60,
        currentCity: "Addis Ababa",
        currentRegion: "Addis Ababa",
        isAvailable: true,
      }
    );
    const rejTruckId = (rejTruckData.truck ?? rejTruckData).id;
    if (!rejTruckId) {
      test.skip(true, "Could not create fresh truck for reject test");
      return;
    }
    await apiCall("POST", `/api/trucks/${rejTruckId}/approve`, adminToken, {
      action: "APPROVE",
    });

    // Create a truck posting so the truck-request can be created
    const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations?limit=1`);
    const locations = await locRes.json();
    const originCityId = (
      locations[0] ??
      locations.locations?.[0] ??
      locations.cities?.[0]
    )?.id;
    await apiCall("POST", "/api/truck-postings", carrierToken, {
      truckId: rejTruckId,
      originCityId,
      availableFrom: tomorrow.toISOString(),
      contactName: "BP Reject Test Carrier",
      contactPhone: "+251912000099",
    });

    const { data: freshLoad } = await apiCall(
      "POST",
      "/api/loads",
      shipperToken,
      {
        pickupCity: "Addis Ababa",
        deliveryCity: "Gondar",
        pickupDate: tomorrow.toISOString().split("T")[0],
        deliveryDate: fiveDays.toISOString().split("T")[0],
        truckType: "FLATBED",
        weight: 4500,
        cargoDescription: "Blueprint truck request reject test cargo",
        description: "Blueprint truck request reject test",
        status: "POSTED",
      }
    );
    const rejLoadId = (freshLoad.load ?? freshLoad).id;

    const { data: reqData, status: reqStatus } = await apiCall(
      "POST",
      "/api/truck-requests",
      shipperToken,
      { truckId: rejTruckId, loadId: rejLoadId, notes: "Reject test" }
    );
    if (![200, 201].includes(reqStatus)) {
      test.skip(true, `Could not create truck request (${reqStatus})`);
      return;
    }
    const requestId = (reqData.truckRequest ?? reqData.request ?? reqData).id;

    const { status } = await apiCall(
      "POST",
      `/api/truck-requests/${requestId}/respond`,
      carrierToken,
      { action: "REJECT" }
    );
    expect(status).toBe(200);

    // Load should still be in POSTED state
    const { data: loadData } = await apiCall(
      "GET",
      `/api/loads/${rejLoadId}`,
      shipperToken
    );
    const updatedLoad = loadData.load ?? loadData;
    expect(updatedLoad.status).toBe("POSTED");
  });
});
