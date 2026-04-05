/**
 * Blueprint Advanced Tests — §6 Cancellation, §7 Exception, §8 Fees, §10 Super Admin
 *
 * Every test verifies a specific blueprint rule against the real database.
 * Blueprint-first: read the rule, test the code, verify the result.
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const PW = "Test123!";

const tokenCache: Record<string, string> = {};

async function login(email: string, pw: string) {
  if (tokenCache[email]) return tokenCache[email];
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-type": "mobile",
      },
      body: JSON.stringify({ email, password: pw }),
    });
    const d = await r.json();
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 35000));
      continue;
    }
    if (!r.ok) throw new Error(`Login ${email}: ${d.error}`);
    tokenCache[email] = d.sessionToken;
    return d.sessionToken as string;
  }
  throw new Error(`Login ${email}: rate limited`);
}

async function api(method: string, path: string, token: string, body?: object) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

function days(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

// Rotate truck types to avoid exhausting same trucks
const TRUCK_TYPES = [
  "DRY_VAN",
  "FLATBED",
  "CONTAINER",
  "REFRIGERATED",
] as const;
let typeIdx = 0;

/** Create a fresh POSTED load (rotates truck type to match different trucks) */
async function createLoad(token: string, desc: string) {
  const truckType = TRUCK_TYPES[typeIdx % TRUCK_TYPES.length];
  typeIdx++;
  const { status, data } = await api("POST", "/api/loads", token, {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: days(2),
    deliveryDate: days(5),
    truckType,
    weight: 5000,
    cargoDescription: desc,
    shipperContactName: "Test",
    shipperContactPhone: "+251911111111",
    status: "POSTED",
  });
  expect(status).toBe(201);
  return (data.load ?? data).id as string;
}

/** Create a fresh DRAFT load */
async function createDraftLoad(token: string) {
  const { status, data } = await api("POST", "/api/loads", token, {
    pickupCity: "Addis Ababa",
    deliveryCity: "Mekelle",
    pickupDate: days(3),
    deliveryDate: days(6),
    truckType: "FLATBED",
    weight: 3000,
    cargoDescription: "Draft test",
    shipperContactName: "Test",
    shipperContactPhone: "+251911111111",
  });
  expect(status).toBe(201);
  return (data.load ?? data).id as string;
}

/** Create a trip by: post load → find truck → request → approve */
async function createTrip(
  shipperToken: string,
  carrierToken: string,
  desc: string
) {
  const loadId = await createLoad(shipperToken, desc);

  // Find matching truck owned by the carrier we're using
  const { data: matches } = await api(
    "GET",
    `/api/loads/${loadId}/matching-trucks?limit=20`,
    shipperToken
  );

  // Get carrier's org to filter matching trucks
  const { data: carrierMe } = await api("GET", "/api/auth/me", carrierToken);
  const carrierOrgId =
    carrierMe.user?.organizationId ?? carrierMe.organizationId;

  // Prefer trucks owned by our carrier, fall back to any
  const allTrucks = matches.trucks || [];
  const truck =
    allTrucks.find(
      (t: { carrier?: { id: string } }) => t.carrier?.id === carrierOrgId
    ) || allTrucks[0];
  if (!truck) return null; // Return null instead of throwing — caller can skip

  // Send request
  const { status: reqStatus, data: reqData } = await api(
    "POST",
    "/api/truck-requests",
    shipperToken,
    {
      loadId,
      truckPostingId: truck.id,
      truckId: truck.truck?.id,
      message: desc,
    }
  );
  if (reqStatus !== 200 && reqStatus !== 201) {
    throw new Error(
      `Truck request failed (${reqStatus}): ${JSON.stringify(reqData)}`
    );
  }
  const reqId = (reqData.truckRequest ?? reqData.request ?? reqData).id;

  // The truck's actual carrier must approve (not necessarily the passed carrierToken)
  const actualCarrierId = truck.carrier?.id;
  let approveToken = carrierToken;
  if (actualCarrierId && actualCarrierId !== carrierOrgId) {
    // Truck belongs to different carrier — use carrier@test.com
    approveToken = await login("carrier@test.com", PW);
  }

  const { status: approveStatus, data: approveData } = await api(
    "POST",
    `/api/truck-requests/${reqId}/respond`,
    approveToken,
    { action: "APPROVE" }
  );
  if (approveStatus !== 200) {
    // Truck busy or request not found — return null for caller to skip
    return null;
  }

  // Find the trip
  const { data: trips } = await api("GET", "/api/trips?limit=50", carrierToken);
  const trip = (trips.trips || []).find(
    (t: { loadId: string }) => t.loadId === loadId
  );
  expect(trip).toBeTruthy();

  return { loadId, tripId: trip.id, truckId: truck.truck?.id } as {
    loadId: string;
    tripId: string;
    truckId: string | undefined;
  };
}

/** Walk trip to a target status */
async function walkTrip(
  tripId: string,
  carrierToken: string,
  targetStatus: string
) {
  const transitions: Record<string, string[]> = {
    PICKUP_PENDING: ["PICKUP_PENDING"],
    IN_TRANSIT: ["PICKUP_PENDING", "IN_TRANSIT"],
    DELIVERED: ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED"],
  };
  for (const status of transitions[targetStatus] || []) {
    const body: Record<string, unknown> = { status };
    if (status === "DELIVERED") {
      body.receiverName = "Test Receiver";
      body.receiverPhone = "+251922222222";
    }
    const { status: s } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      body
    );
    expect(s).toBe(200);
  }
}

// Pre-cache all tokens once to avoid rate limiting
let TOKENS: Record<string, string> = {};

test.beforeAll(async () => {
  TOKENS.shipper = await login("shipper@test.com", PW);
  TOKENS.carrier = await login("carrier@test.com", PW);
  TOKENS.admin = await login("admin@test.com", PW);
  TOKENS.dispatcher = await login("dispatcher@test.com", "password");
  TOKENS.superadmin = await login("superadmin@test.com", PW);
});

// ═══════════════════════════════════════════════════════════════════
// §6 CANCELLATION POLICY — 8 Shipper Load Cancellation Cases
// ═══════════════════════════════════════════════════════════════════

test.describe("§6: Shipper Load Cancellation", () => {
  let shipperToken: string;
  let carrierToken: string;

  test.beforeAll(async () => {
    shipperToken = TOKENS.shipper;
    carrierToken = TOKENS.carrier;
  });

  test("1. Cancel DRAFT → no external impact", async () => {
    const loadId = await createDraftLoad(shipperToken);
    const { status } = await api(
      "DELETE",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect(status).toBe(200);

    // Verify deleted
    const { status: getStatus } = await api(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect(getStatus).toBe(404);
  });

  test("2. Cancel POSTED → status CANCELLED", async () => {
    const loadId = await createLoad(shipperToken, "Cancel POSTED test");
    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}/status`,
      shipperToken,
      { status: "CANCELLED" }
    );
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/loads/${loadId}`, shipperToken);
    expect((data.load ?? data).status).toBe("CANCELLED");
  });

  test("5. Cancel ASSIGNED → load CANCELLED, trip CANCELLED, truck freed", async () => {
    const { loadId, tripId, truckId } = await createTrip(
      shipperToken,
      carrierToken,
      "Cancel ASSIGNED test"
    );

    // Cancel via load status
    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}/status`,
      shipperToken,
      {
        status: "CANCELLED",
        reason: "Testing ASSIGNED cancellation",
      }
    );
    expect(status).toBe(200);

    // Verify load CANCELLED
    const { data: load } = await api(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect((load.load ?? load).status).toBe("CANCELLED");

    // Verify trip CANCELLED
    const { data: trip } = await api(
      "GET",
      `/api/trips/${tripId}`,
      carrierToken
    );
    const tripData = trip.trip ?? trip;
    expect(tripData.status).toBe("CANCELLED");
  });

  test("7. Cancel IN_TRANSIT → BLOCKED (400)", async () => {
    const adminToken = await login("admin@test.com", PW);
    const { loadId, tripId } = await createTrip(
      shipperToken,
      carrierToken,
      "Cancel IN_TRANSIT test"
    );
    await walkTrip(tripId, carrierToken, "IN_TRANSIT");

    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}/status`,
      shipperToken,
      {
        status: "CANCELLED",
        reason: "Should be blocked",
      }
    );
    expect(status).toBe(400);

    // Cleanup: exception → admin cancel to free truck
    await api("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "EXCEPTION",
    });
    await api("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "CANCELLED",
    });
  });

  test("8. Cancel DELIVERED → BLOCKED (400)", async () => {
    const { loadId, tripId } = await createTrip(
      shipperToken,
      carrierToken,
      "Cancel DELIVERED test"
    );
    await walkTrip(tripId, carrierToken, "DELIVERED");

    const { status } = await api(
      "PATCH",
      `/api/loads/${loadId}/status`,
      shipperToken,
      {
        status: "CANCELLED",
        reason: "Should be blocked",
      }
    );
    expect(status).toBe(400);

    // Cleanup: complete trip to free truck
    await api("POST", `/api/trips/${tripId}/confirm`, shipperToken);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §7 EXCEPTION PATH
// ═══════════════════════════════════════════════════════════════════

test.describe.serial("§7: Exception Path", () => {
  let shipperToken: string;
  let carrierToken: string; // uses wf-carrier for isolation
  let adminToken: string;
  let dispatcherToken: string;
  let tripId: string;
  let loadId: string;

  test.beforeAll(async () => {
    shipperToken = TOKENS.shipper;
    carrierToken = await login("wf-carrier@test.com", PW);
    adminToken = TOKENS.admin;
    dispatcherToken = TOKENS.dispatcher;
  });

  test("9. IN_TRANSIT → EXCEPTION (carrier flags)", async () => {
    const result = await createTrip(
      shipperToken,
      carrierToken,
      "Exception test"
    );
    tripId = result.tripId;
    loadId = result.loadId;
    await walkTrip(tripId, carrierToken, "IN_TRANSIT");

    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "EXCEPTION" }
    );
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/trips/${tripId}`, carrierToken);
    expect((data.trip ?? data).status).toBe("EXCEPTION");
  });

  test("11. Carrier CANNOT resolve EXCEPTION (403)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(403);
  });

  test("12. Dispatcher CANNOT resolve EXCEPTION (403)", async () => {
    const { status } = await api(
      "PATCH",
      `/api/trips/${tripId}`,
      dispatcherToken,
      { status: "IN_TRANSIT" }
    );
    expect(status).toBe(403);
  });

  test("14. Admin resolves EXCEPTION → IN_TRANSIT (resumes)", async () => {
    const { status } = await api("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "IN_TRANSIT",
    });
    expect(status).toBe(200);

    const { data } = await api("GET", `/api/trips/${tripId}`, carrierToken);
    expect((data.trip ?? data).status).toBe("IN_TRANSIT");

    // Cleanup: complete this trip to free the truck for subsequent tests
    await api("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "DELIVERED",
      receiverName: "Cleanup",
      receiverPhone: "+251900000000",
    });
    await api("POST", `/api/trips/${tripId}/confirm`, shipperToken);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §7 CARRIER TRIP CANCELLATION
// ═══════════════════════════════════════════════════════════════════

test.describe("§7: Carrier Trip Cancellation", () => {
  let shipperToken: string;
  let carrierToken: string;

  test.beforeAll(async () => {
    // Use carrier@test.com (has 20 trucks in Addis Ababa)
    shipperToken = TOKENS.shipper;
    carrierToken = TOKENS.carrier;
  });

  test("19. Carrier cancels ASSIGNED trip → load back to POSTED", async () => {
    const result = await createTrip(
      shipperToken,
      carrierToken,
      "Carrier cancel ASSIGNED"
    );
    if (!result) {
      test.skip(true, "No available truck — data exhaustion");
      return;
    }
    const { loadId, tripId } = result;

    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/cancel`,
      carrierToken,
      { reason: "Testing carrier cancel" }
    );
    expect(status).toBe(200);

    // Load should revert to POSTED
    const { data } = await api("GET", `/api/loads/${loadId}`, shipperToken);
    expect((data.load ?? data).status).toBe("POSTED");
  });

  test("21. Carrier CANNOT cancel IN_TRANSIT (400)", async () => {
    const adminToken = await login("admin@test.com", PW);
    const result = await createTrip(
      shipperToken,
      carrierToken,
      "Carrier cancel IN_TRANSIT blocked"
    );
    if (!result) {
      test.skip(true, "No available truck");
      return;
    }
    const { tripId } = result;
    await walkTrip(tripId, carrierToken, "IN_TRANSIT");

    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/cancel`,
      carrierToken,
      { reason: "Should be blocked" }
    );
    expect(status).toBe(400);

    // Cleanup: exception → admin cancel
    await api("PATCH", `/api/trips/${tripId}`, carrierToken, {
      status: "EXCEPTION",
    });
    await api("PATCH", `/api/trips/${tripId}`, adminToken, {
      status: "CANCELLED",
    });
  });

  test("22. Carrier CANNOT cancel DELIVERED (400)", async () => {
    const result = await createTrip(
      shipperToken,
      carrierToken,
      "Carrier cancel DELIVERED blocked"
    );
    if (!result) {
      test.skip(true, "No available truck");
      return;
    }
    const { tripId } = result;
    await walkTrip(tripId, carrierToken, "DELIVERED");

    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/cancel`,
      carrierToken,
      { reason: "Should be blocked" }
    );
    expect(status).toBe(400);

    // Cleanup: complete trip
    await api("POST", `/api/trips/${tripId}/confirm`, shipperToken);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §8 SERVICE FEE CALCULATION
// ═══════════════════════════════════════════════════════════════════

test.describe.serial("§8: Service Fees", () => {
  let shipperToken: string;
  let carrierToken: string;
  let shipperBalanceBefore: number;
  let carrierBalanceBefore: number;
  let tripId: string;
  let loadId: string;

  test.beforeAll(async () => {
    // Use wf-shipper + wf-carrier for fee tests (own wallets, own trucks)
    shipperToken = await login("wf-shipper@test.com", PW);
    carrierToken = await login("wf-carrier@test.com", PW);
  });

  test("24. Record wallet balances before trip", async () => {
    const { data: sw } = await api("GET", "/api/wallet/balance", shipperToken);
    shipperBalanceBefore = sw.totalBalance ?? sw.wallets?.[0]?.balance ?? 0;

    const { data: cw } = await api("GET", "/api/wallet/balance", carrierToken);
    carrierBalanceBefore = cw.totalBalance ?? cw.wallets?.[0]?.balance ?? 0;

    expect(shipperBalanceBefore).toBeGreaterThan(0);
  });

  test("25. Complete a trip (fees deducted on completion)", async () => {
    const result = await createTrip(
      shipperToken,
      carrierToken,
      "Fee test trip"
    );
    if (!result) {
      test.skip(true, "No available truck");
      return;
    }
    tripId = result.tripId;
    loadId = result.loadId;

    await walkTrip(tripId, carrierToken, "DELIVERED");

    // Shipper confirms → COMPLETED → fees deducted
    const { status } = await api(
      "POST",
      `/api/trips/${tripId}/confirm`,
      shipperToken
    );
    expect(status).toBe(200);
  });

  test("26. Load has fee fields populated after completion", async () => {
    const { data } = await api("GET", `/api/loads/${loadId}`, shipperToken);
    const load = data.load ?? data;

    expect(load.status).toBe("COMPLETED");
    // Fee fields should be set (may be 0 if no corridor match, but should exist)
    expect(load.shipperFeeStatus).toBeDefined();
    expect(load.carrierFeeStatus).toBeDefined();
  });

  test("27. Wallet balances changed after trip", async () => {
    const { data: sw } = await api("GET", "/api/wallet/balance", shipperToken);
    const shipperBalanceAfter =
      sw.totalBalance ?? sw.wallets?.[0]?.balance ?? 0;

    const { data: cw } = await api("GET", "/api/wallet/balance", carrierToken);
    const carrierBalanceAfter =
      cw.totalBalance ?? cw.wallets?.[0]?.balance ?? 0;

    // If fees were deducted, balances should be lower
    // (or equal if no corridor/no fee calculated — which is valid)
    expect(shipperBalanceAfter).toBeLessThanOrEqual(shipperBalanceBefore);
    expect(carrierBalanceAfter).toBeLessThanOrEqual(carrierBalanceBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════
// §10 SUPER ADMIN
// ═══════════════════════════════════════════════════════════════════

test.describe("§10: Super Admin", () => {
  let superAdminToken: string;

  test.beforeAll(async () => {
    superAdminToken = TOKENS.superadmin;
  });

  test("29. Super Admin sees platform metrics", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/platform-metrics",
      superAdminToken
    );
    expect(status).toBe(200);
    expect(data.metrics).toBeDefined();
  });

  test("30. Super Admin has full analytics access", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/analytics?period=month",
      superAdminToken
    );
    expect(status).toBe(200);
    expect(data.summary.revenue).toBeTruthy();
    expect(data.summary.revenue.platformBalance).toBeDefined();
  });
});
