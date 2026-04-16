/**
 * Action Buttons E2E Test — Tests every action button actually WORKS
 *
 * Not testing page loads or selectors — testing that clicking a button
 * produces the expected result in the database/API.
 *
 * Uses dedicated test users to avoid conflicts with other test suites.
 */

import { test, expect } from "@playwright/test";
import { freeUpCarrierTrucks } from "./shared/trip-cleanup";

const BASE_URL = "http://localhost:3000";
const TEST_PASSWORD = "Test123!";

// Dedicated users
const SHIPPER = { email: "shipper@test.com", password: TEST_PASSWORD };
const CARRIER = { email: "carrier@test.com", password: TEST_PASSWORD };
const ADMIN = { email: "admin@test.com", password: TEST_PASSWORD };
const DISPATCHER = {
  email: "dispatcher@test.com",
  password: "password",
};

async function login(
  email: string,
  password: string
): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.error}`);
  return {
    token: data.sessionToken,
    userId: data.user?.id,
  };
}

async function api(method: string, path: string, token: string, body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════════════
// SHIPPER ACTIONS
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Shipper Action Buttons", () => {
  let shipperToken: string;
  let loadId: string;

  test.beforeAll(async () => {
    const { token } = await login(SHIPPER.email, SHIPPER.password);
    shipperToken = token;
  });

  test("Create Load (POST /api/loads)", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 7);

    const { status, data } = await api("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow.toISOString(),
      deliveryDate: fiveDays.toISOString(),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "Action button test load",
      shipperContactName: "Action Test",
      shipperContactPhone: "+251911111111",
    });
    expect(status).toBe(201);
    loadId = data.load?.id ?? data.id;
    expect(loadId).toBeTruthy();

    // Verify it exists
    const { status: getStatus, data: getData } = await api(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect(getStatus).toBe(200);
    const load = getData.load ?? getData;
    expect(load.status).toBe("DRAFT");
    expect(load.cargoDescription).toBe("Action button test load");
  });

  test("Post Load (DRAFT → POSTED)", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      shipperToken,
      { status: "POSTED" }
    );
    expect(status).toBe(200);
    const load = data.load ?? data;
    expect(load.status).toBe("POSTED");
  });

  test("Edit Posted Load (Unpost → Edit → Repost)", async () => {
    // Unpost first
    const { status: s1 } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      shipperToken,
      { status: "UNPOSTED" }
    );
    expect(s1).toBe(200);

    // Edit fields
    const { status: s2 } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      shipperToken,
      { weight: 7500, cargoDescription: "Updated cargo", status: "POSTED" }
    );
    expect(s2).toBe(200);

    // Verify changes persisted
    const { data: verify } = await api(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    const load = verify.load ?? verify;
    expect(Number(load.weight)).toBe(7500);
    expect(load.cargoDescription).toBe("Updated cargo");
    expect(load.status).toBe("POSTED");
  });

  test("Edit POSTED Load directly returns 409", async () => {
    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      shipperToken,
      { weight: 9999 }
    );
    expect(status).toBe(409);
  });

  test("Unpost Load (POSTED → UNPOSTED)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      shipperToken,
      { status: "UNPOSTED" }
    );
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/loads/${loadId}`, shipperToken);
    expect((data.load ?? data).status).toBe("UNPOSTED");
  });

  test("Repost Load (UNPOSTED → POSTED)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      shipperToken,
      { status: "POSTED" }
    );
    expect(status).toBe(200);
  });

  test("Duplicate Load (POST /api/loads/{id}/duplicate)", async () => {
    const { status, data } = await api(
      "POST",
      `/api/loads/${loadId}/duplicate`,
      shipperToken
    );
    // Duplicate might return 201 or 200
    expect([200, 201]).toContain(status);
    const dup = data.load ?? data;
    expect(dup.id).toBeTruthy();
    expect(dup.id).not.toBe(loadId);
    expect(dup.status).toBe("DRAFT");

    // Clean up duplicate
    await api("DELETE", `/api/loads/${dup.id}`, shipperToken);
  });

  test("Cancel Load (POSTED → CANCELLED)", async () => {
    // Create a new load to cancel (keep the main one for later tests)
    const { data: newLoad } = await api("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Mekelle",
      pickupDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      deliveryDate: new Date(Date.now() + 6 * 86400000).toISOString(),
      truckType: "FLATBED",
      weight: 3000,
      cargoDescription: "Cancel test",
      shipperContactName: "Cancel Test",
      shipperContactPhone: "+251911111111",
      status: "POSTED",
    });
    const cancelId = newLoad.load?.id ?? newLoad.id;

    const { status } = await api(
      "PATCH",
      `/api/loads/${cancelId}/status`,
      shipperToken,
      { status: "CANCELLED", reason: "E2E cancel test" }
    );
    expect(status).toBe(200);

    const { data: verify } = await api(
      "GET",
      `/api/loads/${cancelId}`,
      shipperToken
    );
    expect((verify.load ?? verify).status).toBe("CANCELLED");
  });

  test("Delete Draft Load (DELETE /api/loads/{id})", async () => {
    // Create a draft to delete
    const { data: draft } = await api("POST", "/api/loads", shipperToken, {
      pickupCity: "Hawassa",
      deliveryCity: "Addis Ababa",
      pickupDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      deliveryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      truckType: "DRY_VAN",
      weight: 2000,
      cargoDescription: "Delete test",
      shipperContactName: "Delete Test",
      shipperContactPhone: "+251911111111",
    });
    const deleteId = draft.load?.id ?? draft.id;

    const { status } = await api(
      "DELETE",
      `/api/loads/${deleteId}`,
      shipperToken
    );
    expect(status).toBe(200);

    // Verify deleted
    const { status: getStatus } = await api(
      "GET",
      `/api/loads/${deleteId}`,
      shipperToken
    );
    expect(getStatus).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CARRIER ACTIONS
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Carrier Action Buttons", () => {
  let carrierToken: string;
  let truckId: string;
  let postingId: string;

  test.beforeAll(async () => {
    const { token } = await login(CARRIER.email, CARRIER.password);
    carrierToken = token;
  });

  test("Register Truck (POST /api/trucks)", async () => {
    const plate = `ACT-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const { status, data } = await api("POST", "/api/trucks", carrierToken, {
      truckType: "DRY_VAN",
      licensePlate: plate,
      capacity: 15000,
      currentCity: "Addis Ababa",
      currentRegion: "Addis Ababa",
      isAvailable: true,
    });
    expect(status).toBe(201);
    truckId = (data.truck ?? data).id;
    expect(truckId).toBeTruthy();
  });

  test("Edit Truck (PATCH /api/trucks/{id})", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/trucks/${truckId}`,
      carrierToken,
      { capacity: 18000, currentCity: "Dire Dawa" }
    );
    expect(status).toBe(200);
    const truck = data.truck ?? data;
    expect(Number(truck.capacity)).toBe(18000);
    expect(truck.currentCity).toBe("Dire Dawa");
  });

  test("Post Truck (POST /api/truck-postings) — uses existing approved truck", async () => {
    // Use an existing seed truck that's already approved with GPS
    const { data: myTrucks } = await api(
      "GET",
      "/api/trucks?myTrucks=true&limit=20",
      carrierToken
    );
    const approvedTruck = (myTrucks.trucks || []).find(
      (t: {
        approvalStatus: string;
        isAvailable: boolean;
        gpsDeviceId: string | null;
      }) => t.approvalStatus === "APPROVED" && t.isAvailable && t.gpsDeviceId
    );

    if (!approvedTruck) {
      test.skip(true, "No approved truck with GPS available");
      return;
    }

    // Check if it already has a posting
    const { data: existingPostings } = await api(
      "GET",
      "/api/truck-postings?limit=50",
      carrierToken
    );
    const hasPosting = (existingPostings.postings || []).some(
      (p: { truckId: string; status: string }) =>
        p.truckId === approvedTruck.id && p.status === "ACTIVE"
    );

    if (hasPosting) {
      // Already posted — find the posting ID
      const existing = (existingPostings.postings || []).find(
        (p: { truckId: string; status: string }) =>
          p.truckId === approvedTruck.id && p.status === "ACTIVE"
      );
      postingId = existing.id;
      expect(postingId).toBeTruthy();
    } else {
      // Create new posting
      const { data: locs } = await api(
        "GET",
        "/api/ethiopian-locations?limit=1",
        carrierToken
      );
      const originCityId = (locs.locations ?? locs.cities ?? locs)?.[0]?.id;

      const { status, data } = await api(
        "POST",
        "/api/truck-postings",
        carrierToken,
        {
          truckId: approvedTruck.id,
          originCityId,
          availableFrom: new Date().toISOString(),
          contactName: "Action Test",
          contactPhone: "+251922222222",
        }
      );
      if (status === 409 && data.existingPostId) {
        // Truck already posted — use existing
        postingId = data.existingPostId;
      } else {
        expect([200, 201]).toContain(status);
        postingId = (data.posting ?? data).id;
      }
    }
    expect(postingId).toBeTruthy();
  });

  test("Edit Truck Posting (PATCH /api/truck-postings/{id})", async () => {
    test.skip(!postingId, "No posting to edit");
    const { status, data } = await api(
      "PATCH",
      `/api/truck-postings/${postingId}`,
      carrierToken,
      { contactName: "Updated Driver Name", contactPhone: "+251933333333" }
    );
    expect(status).toBe(200);
    const posting = data.posting ?? data;
    expect(posting.contactName).toBe("Updated Driver Name");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REQUEST & BOOKING FLOW
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Request & Booking Actions", () => {
  let shipperToken: string;
  let carrierToken: string;
  let adminToken: string;
  let loadId: string;
  let requestId: string;
  let tripId: string;

  test.beforeAll(async () => {
    const s = await login(SHIPPER.email, SHIPPER.password);
    shipperToken = s.token;
    const c = await login(CARRIER.email, CARRIER.password);
    carrierToken = c.token;
    const a = await login(ADMIN.email, ADMIN.password);
    adminToken = a.token;
    // Earlier specs in chromium project (platform-lifecycle, blueprint-*)
    // can leave trips on the carrier's trucks in non-terminal states which
    // would block the APPROVE step below. Cleanup here is idempotent.
    await freeUpCarrierTrucks(carrierToken, adminToken);
  });

  test("Shipper creates + posts load", async () => {
    const { status, data } = await api("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      deliveryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "Booking flow test",
      shipperContactName: "Booking Test",
      shipperContactPhone: "+251911111111",
      status: "POSTED",
    });
    expect(status).toBe(201);
    loadId = (data.load ?? data).id;
  });

  test("Shipper sends truck request (POST /api/truck-requests)", async () => {
    // Find a matching truck owned by carrier@test.com (the APPROVE step below
    // requires the carrier to own the truck — limit=1 + first-match picked a
    // truck from another carrier in the full suite, producing 404 on APPROVE).
    const { data: meData } = await api("GET", "/api/auth/me", carrierToken);
    const carrierOrgId = meData.user?.organizationId ?? meData.organizationId;
    expect(carrierOrgId, "carrier org id missing").toBeTruthy();

    const { data: matches } = await api(
      "GET",
      `/api/loads/${loadId}/matching-trucks?limit=50`,
      shipperToken
    );
    const trucks = matches.trucks || [];
    const truckPosting = trucks.find(
      (t: { carrier?: { id?: string } }) => t.carrier?.id === carrierOrgId
    );
    test.skip(
      !truckPosting,
      "No matching truck owned by carrier@test.com in the current state"
    );

    const truckIdForRequest = truckPosting.truck?.id || truckPosting.truckId;

    const { status, data } = await api(
      "POST",
      "/api/truck-requests",
      shipperToken,
      {
        loadId,
        truckPostingId: truckPosting.id,
        truckId: truckIdForRequest,
        message: "Booking test request",
      }
    );
    expect([200, 201]).toContain(status);
    requestId = (data.truckRequest ?? data.request ?? data).id;
    expect(requestId).toBeTruthy();
  });

  test("Carrier approves truck request (APPROVE)", async () => {
    test.skip(!requestId, "No request to approve");
    const { status } = await api(
      "POST",
      `/api/truck-requests/${requestId}/respond`,
      carrierToken,
      { action: "APPROVE" }
    );
    expect(status).toBe(200);

    // Verify load is now ASSIGNED
    const { data } = await api("GET", `/api/loads/${loadId}`, shipperToken);
    const load = data.load ?? data;
    expect(load.status).toBe("ASSIGNED");
    expect(load.assignedTruckId).toBeTruthy();
  });

  test("Trip created after assignment", async () => {
    const { data } = await api("GET", "/api/trips?limit=5", carrierToken);
    const trips = data.trips || [];
    const trip = trips.find((t: { loadId: string }) => t.loadId === loadId);
    expect(trip).toBeTruthy();
    tripId = trip.id;
    expect(trip.status).toBe("ASSIGNED");
  });

  test("Carrier: Confirm Pickup (ASSIGNED → PICKUP_PENDING)", async () => {
    test.skip(!tripId, "No trip");
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "PICKUP_PENDING" }
    );
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/trips/${tripId}`, carrierToken);
    expect((data.trip ?? data).status).toBe("PICKUP_PENDING");
  });

  test("Carrier: Start Transit (PICKUP_PENDING → IN_TRANSIT)", async () => {
    test.skip(!tripId, "No trip");
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/trips/${tripId}`, carrierToken);
    expect((data.trip ?? data).status).toBe("IN_TRANSIT");
  });

  test("Carrier: Mark Delivered (IN_TRANSIT → DELIVERED)", async () => {
    test.skip(!tripId, "No trip");
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      {
        status: "DELIVERED",
        receiverName: "John Doe",
        receiverPhone: "+251922222222",
      }
    );
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/trips/${tripId}`, carrierToken);
    expect((data.trip ?? data).status).toBe("DELIVERED");
  });

  test("Shipper: Confirm Delivery (DELIVERED → COMPLETED)", async () => {
    test.skip(!tripId, "No trip");
    const { status, data } = await api(
      "POST",
      `/api/trips/${tripId}/confirm`,
      shipperToken
    );
    expect(status).toBe(200);
    expect(data.trip?.status ?? data.status).toBe("COMPLETED");
  });

  test("Shipper: Rate Carrier (POST /api/trips/{id}/rate)", async () => {
    test.skip(!tripId, "No trip");
    const { status, data } = await api(
      "POST",
      `/api/trips/${tripId}/rate`,
      shipperToken,
      { stars: 5, comment: "Excellent service!" }
    );
    expect(status).toBe(201);
    expect(data.rating?.stars).toBe(5);
  });

  test("Carrier: Rate Shipper", async () => {
    test.skip(!tripId, "No trip");
    const { status, data } = await api(
      "POST",
      `/api/trips/${tripId}/rate`,
      carrierToken,
      { stars: 4, comment: "Good cargo description" }
    );
    expect(status).toBe(201);
    expect(data.rating?.stars).toBe(4);
  });

  test("Cannot rate same trip twice", async () => {
    test.skip(!tripId, "No trip");
    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/rate`,
      shipperToken,
      { stars: 3 }
    );
    expect(status).toBe(409);
  });

  test("Chat read-only on completed trip", async () => {
    test.skip(!tripId, "No trip");
    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/messages`,
      shipperToken,
      { content: "Should fail" }
    );
    expect(status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN ACTIONS
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Admin Action Buttons", () => {
  let adminToken: string;

  test.beforeAll(async () => {
    const { token } = await login(ADMIN.email, ADMIN.password);
    adminToken = token;
  });

  test("Admin: View all users", async () => {
    const { status, data } = await api("GET", "/api/admin/users", adminToken);
    expect(status).toBe(200);
    expect(data.users?.length).toBeGreaterThan(0);
  });

  test("Admin: View all organizations", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/organizations",
      adminToken
    );
    expect(status).toBe(200);
  });

  test("Admin: Analytics returns chart data", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/analytics?startDate=2026-01-01&endDate=2026-12-31",
      adminToken
    );
    expect(status).toBe(200);
    expect(data.charts).toBeTruthy();
    expect(data.summary).toBeTruthy();
  });

  test("Admin: Platform metrics", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/platform-metrics",
      adminToken
    );
    expect([200, 403]).toContain(status); // May require SUPER_ADMIN
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DISPATCHER ACTIONS
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Dispatcher Action Buttons", () => {
  let dispatcherToken: string;

  test.beforeAll(async () => {
    const { token } = await login(DISPATCHER.email, DISPATCHER.password);
    dispatcherToken = token;
  });

  test("Dispatcher: View all loads (platform-wide)", async () => {
    const { status, data } = await api(
      "GET",
      "/api/loads?limit=50",
      dispatcherToken
    );
    expect(status).toBe(200);
    expect(data.loads?.length).toBeGreaterThan(0);
  });

  test("Dispatcher: View all truck postings", async () => {
    const { status, data } = await api(
      "GET",
      "/api/truck-postings?limit=50",
      dispatcherToken
    );
    expect(status).toBe(200);
  });

  test("Dispatcher: View all trips", async () => {
    const { status, data } = await api(
      "GET",
      "/api/trips?limit=50",
      dispatcherToken
    );
    expect(status).toBe(200);
  });

  test("Dispatcher: Dashboard returns stats", async () => {
    const { status, data } = await api(
      "GET",
      "/api/dispatcher/dashboard",
      dispatcherToken
    );
    expect(status).toBe(200);
    expect(data.stats).toBeTruthy();
  });

  test("Dispatcher: CANNOT see financials", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/analytics?period=month",
      dispatcherToken
    );
    expect(status).toBe(200);
    expect(data.summary?.revenue).toBeNull();
  });

  test("Dispatcher: CANNOT edit loads", async () => {
    const { data: loads } = await api(
      "GET",
      "/api/loads?status=POSTED&limit=1",
      dispatcherToken
    );
    const loadId = loads.loads?.[0]?.id;
    if (!loadId) return;

    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}`,
      dispatcherToken,
      { weight: 9999 }
    );
    expect(status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CANCELLATION & REJECTION ACTIONS
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Cancellation & Rejection Actions", () => {
  let shipperToken: string;
  let carrierToken: string;

  test.beforeAll(async () => {
    const s = await login(SHIPPER.email, SHIPPER.password);
    shipperToken = s.token;
    const c = await login(CARRIER.email, CARRIER.password);
    carrierToken = c.token;
  });

  test("Carrier: Reject truck request", async () => {
    // Create a load
    const { data: loadData } = await api("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      pickupDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      deliveryDate: new Date(Date.now() + 6 * 86400000).toISOString(),
      truckType: "DRY_VAN",
      weight: 3000,
      cargoDescription: "Reject test",
      shipperContactName: "Reject Test",
      shipperContactPhone: "+251911111111",
      status: "POSTED",
    });
    const rejectLoadId = (loadData.load ?? loadData).id;

    // Find matching truck owned by carrier@test.com — REJECT also requires
    // the responding carrier to own the truck or the API returns 404.
    const { data: meData } = await api("GET", "/api/auth/me", carrierToken);
    const carrierOrgId = meData.user?.organizationId ?? meData.organizationId;
    const { data: matches } = await api(
      "GET",
      `/api/loads/${rejectLoadId}/matching-trucks?limit=50`,
      shipperToken
    );
    const trucks = matches.trucks || [];
    const truckPosting = trucks.find(
      (t: { carrier?: { id?: string } }) => t.carrier?.id === carrierOrgId
    );
    if (!truckPosting) {
      test.skip(
        true,
        "No matching truck owned by carrier@test.com in the current state"
      );
      return;
    }

    // Send request
    const { data: reqData } = await api(
      "POST",
      "/api/truck-requests",
      shipperToken,
      {
        loadId: rejectLoadId,
        truckPostingId: truckPosting.id,
        truckId: truckPosting.truck?.id,
        message: "Reject test",
      }
    );
    const reqId = (reqData.truckRequest ?? reqData.request ?? reqData).id;

    // Carrier rejects
    const { status } = await api(
      "POST",
      `/api/truck-requests/${reqId}/respond`,
      carrierToken,
      { action: "REJECT" }
    );
    expect(status).toBe(200);

    // Clean up
    await api("PATCH", `/api/loads/${rejectLoadId}/status`, shipperToken, {
      status: "CANCELLED",
    });
  });
});
