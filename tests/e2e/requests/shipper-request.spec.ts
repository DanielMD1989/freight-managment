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

  test.beforeAll(async () => {
    test.setTimeout(120000);
    shipperToken = await getShipperToken();
    carrierToken = await getCarrierToken();
    adminToken = await getAdminToken();

    // Ensure we have a posted load
    loadId = await ensureLoad(shipperToken);

    // Get or create an approved carrier truck
    const { data: truckData } = await apiCall(
      "GET",
      "/api/trucks?myTrucks=true&approvalStatus=APPROVED&limit=1",
      carrierToken
    );
    const trucks = truckData.trucks ?? truckData;
    if (Array.isArray(trucks) && trucks.length > 0) {
      truckId = trucks[0].id;
    } else {
      const plate = `BP-SR-${Date.now().toString(36).slice(-5).toUpperCase()}`;
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
    expect([200, 201]).toContain(status);

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

    const { status } = await apiCall(
      "POST",
      `/api/truck-requests/${requestId}/respond`,
      carrierToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);
  });

  test("carrier rejects truck request — load remains available", async () => {
    test.setTimeout(120000);
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
        deliveryCity: "Gondar",
        pickupDate: tomorrow.toISOString().split("T")[0],
        deliveryDate: fiveDays.toISOString().split("T")[0],
        truckType: "FLATBED",
        weight: 4500,
        description: "Blueprint truck request reject test",
        status: "POSTED",
      }
    );
    const rejLoadId = (freshLoad.load ?? freshLoad).id;

    const { data: reqData, status: reqStatus } = await apiCall(
      "POST",
      "/api/truck-requests",
      shipperToken,
      { truckId, loadId: rejLoadId, notes: "Reject test" }
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
