/**
 * Blueprint §3 — Carrier sends load request (carrier→shipper booking path)
 *
 * Tests the carrier-initiates-request flow via /api/load-requests.
 */

import { test, expect } from "@playwright/test";
import {
  apiCall,
  getShipperToken,
  getCarrierToken,
  getAdminToken,
  BASE_URL,
} from "../shared/test-utils";

test.describe("Carrier → Load Request flow", () => {
  let shipperToken: string;
  let carrierToken: string;
  let adminToken: string;
  let truckId: string;

  test.beforeAll(async () => {
    test.setTimeout(120000);
    shipperToken = await getShipperToken();
    carrierToken = await getCarrierToken();
    adminToken = await getAdminToken();

    // Always create a fresh truck to avoid "truck already on trip" 409s from prior runs
    const plate = `BP-CR-${Date.now().toString(36).toUpperCase()}`;
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

    // Create an active truck posting so POST /api/load-requests doesn't return 400
    const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations`);
    const locations = await locRes.json();
    const allLocs: Array<{ id: string }> =
      locations.locations ?? locations.cities ?? locations ?? [];
    const originCityId = allLocs[0]?.id;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await apiCall("POST", "/api/truck-postings", carrierToken, {
      truckId,
      originCityId,
      availableFrom: tomorrow.toISOString(),
      contactName: "BP Carrier Request Carrier",
      contactPhone: "+251912000021",
    });
  });

  /** Helper: create a fresh POSTED load as shipper. */
  async function createFreshLoad() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    const { data } = await apiCall("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Jimma",
      pickupDate: tomorrow.toISOString().split("T")[0],
      deliveryDate: fiveDays.toISOString().split("T")[0],
      truckType: "FLATBED",
      weight: 4000,
      cargoDescription: "Blueprint carrier request test cargo",
      description: "Blueprint carrier request test",
      status: "POSTED",
    });
    return (data.load ?? data).id as string;
  }

  test("carrier sends load request — POST /api/load-requests returns 201", async () => {
    test.setTimeout(90000);
    const loadId = await createFreshLoad();

    const { status, data } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId, truckId, notes: "Blueprint carrier request" }
    );
    expect(status).toBe(201);
    const req = data.loadRequest ?? data.request ?? data;
    expect(req.id).toBeDefined();
  });

  test("shipper accepts → SHIPPER_APPROVED status", async () => {
    test.setTimeout(90000);
    const loadId = await createFreshLoad();

    const { data: reqData, status: reqStatus } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId, truckId, notes: "Accept flow test" }
    );
    if (reqStatus !== 201) {
      test.skip(true, `Could not create load request (${reqStatus})`);
      return;
    }
    const requestId = (reqData.loadRequest ?? reqData.request ?? reqData).id;

    const { status } = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      shipperToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    const { data } = await apiCall(
      "GET",
      `/api/load-requests/${requestId}`,
      carrierToken
    );
    const req = data.loadRequest ?? data.request ?? data;
    expect(req.status).toMatch(/SHIPPER_APPROVED|APPROVED/i);
  });

  test("carrier confirms booking — POST /api/load-requests/:id/confirm returns trip", async () => {
    test.setTimeout(120000);
    const loadId = await createFreshLoad();

    // Create request
    const { data: reqData } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId, truckId, notes: "Confirm flow test" }
    );
    const requestId = (reqData.loadRequest ?? reqData.request ?? reqData).id;

    // Shipper approves
    await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      shipperToken,
      { action: "APPROVE" }
    );

    // Carrier confirms
    const { status, data } = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/confirm`,
      carrierToken,
      { action: "CONFIRM" }
    );
    expect(status).toBe(200);
    const trip = data.trip ?? data;
    expect(trip.id).toBeDefined();
    expect(trip.status).toBe("ASSIGNED");
  });

  test("shipper rejects load request — carrier can request another load", async () => {
    test.setTimeout(120000);
    const loadId = await createFreshLoad();

    const { data: reqData, status: reqStatus } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId, truckId, notes: "Reject test" }
    );
    if (reqStatus !== 201) {
      test.skip(true, `Could not create load request (${reqStatus})`);
      return;
    }
    const requestId = (reqData.loadRequest ?? reqData.request ?? reqData).id;

    // Shipper rejects
    const { status: rejectStatus } = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      shipperToken,
      { action: "REJECT" }
    );
    expect(rejectStatus).toBe(200);

    // Carrier can now request another load
    const anotherLoadId = await createFreshLoad();
    const { status: anotherStatus } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId: anotherLoadId, truckId, notes: "Second attempt after reject" }
    );
    expect(anotherStatus).toBe(201);
  });
});
