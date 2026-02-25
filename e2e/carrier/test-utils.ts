/**
 * Shared test utilities for carrier deep E2E tests.
 *
 * Reuses the token-cache infrastructure from the shipper test-utils
 * and adds carrier-specific data factories.
 */

import { Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

export const BASE_URL = "http://localhost:3000";
export const TEST_PASSWORD = "Test123!";

// ── Token cache (shared with shipper tests to avoid rate-limit exhaustion) ──

const TOKEN_CACHE_DIR = path.join(__dirname, "../.auth");
const TOKEN_CACHE_FILE = path.join(TOKEN_CACHE_DIR, "token-cache.json");
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface TokenCache {
  [email: string]: { token: string; timestamp: number };
}

function readTokenCache(): TokenCache {
  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, "utf-8"));
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeTokenCache(cache: TokenCache) {
  fs.mkdirSync(TOKEN_CACHE_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache));
}

// ── API helpers ──────────────────────────────────────────────────────

export async function apiCall(
  method: string,
  urlPath: string,
  token: string,
  body?: object
) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-client-type": "mobile",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function getToken(
  email: string,
  password: string = TEST_PASSWORD
): Promise<string> {
  const cache = readTokenCache();
  const cached = cache[email];
  if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
    return cached.token;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-type": "mobile",
      },
      body: JSON.stringify({ email, password }),
    });

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 35000));
      continue;
    }

    const data = await res.json();
    if (!res.ok) {
      if (data.error?.includes("Too many") && attempt < 2) {
        await new Promise((r) => setTimeout(r, 35000));
        continue;
      }
      throw new Error(`Login failed for ${email}: ${data.error}`);
    }

    cache[email] = { token: data.sessionToken, timestamp: Date.now() };
    writeTokenCache(cache);

    return data.sessionToken;
  }

  throw new Error(`Login failed for ${email}: rate limited after 3 attempts`);
}

// ── Shorthand token getters ─────────────────────────────────────────

export function getCarrierToken() {
  return getToken("carrier@test.com");
}

export function getShipperToken() {
  return getToken("shipper@test.com");
}

export function getAdminToken() {
  return getToken("admin@test.com");
}

// ── Carrier-specific data factories ─────────────────────────────────

/** Find an existing APPROVED truck or create + admin-approve one. */
export async function ensureTruck(
  carrierToken: string
): Promise<{ truckId: string; licensePlate: string }> {
  // Look for an existing approved truck
  const { data } = await apiCall(
    "GET",
    "/api/trucks?myTrucks=true&approvalStatus=APPROVED&limit=1",
    carrierToken
  );
  const trucks = data.trucks ?? data;
  if (Array.isArray(trucks) && trucks.length > 0) {
    return { truckId: trucks[0].id, licensePlate: trucks[0].licensePlate };
  }

  // Also check for any truck (not just approved)
  const { data: allData } = await apiCall(
    "GET",
    "/api/trucks?myTrucks=true&limit=1",
    carrierToken
  );
  const allTrucks = allData.trucks ?? allData;
  if (Array.isArray(allTrucks) && allTrucks.length > 0) {
    const t = allTrucks[0];
    // Try to admin-approve it if pending
    if (t.approvalStatus === "PENDING") {
      try {
        const adminToken = await getAdminToken();
        await apiCall("POST", `/api/trucks/${t.id}/approve`, adminToken, {
          action: "APPROVE",
        });
      } catch {
        /* best effort */
      }
    }
    return { truckId: t.id, licensePlate: t.licensePlate };
  }

  // Create a new truck
  const plate = `ET-E2E-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const { status, data: created } = await apiCall(
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
  if (status !== 201) {
    throw new Error(`Failed to create truck: ${JSON.stringify(created)}`);
  }
  const truck = created.truck ?? created;

  // Admin-approve
  try {
    const adminToken = await getAdminToken();
    await apiCall("POST", `/api/trucks/${truck.id}/approve`, adminToken, {
      action: "APPROVE",
    });
  } catch {
    /* best effort */
  }

  return { truckId: truck.id, licensePlate: truck.licensePlate ?? plate };
}

/** Find an active truck posting or create one. */
export async function ensureTruckPosting(
  carrierToken: string,
  truckId: string
): Promise<string> {
  // Check for existing active posting for this truck
  const { data: meData } = await apiCall("GET", "/api/auth/me", carrierToken);
  const orgId = meData.user?.organizationId ?? meData.organizationId;

  if (orgId) {
    const { data } = await apiCall(
      "GET",
      `/api/truck-postings?organizationId=${orgId}&status=ACTIVE&limit=5`,
      carrierToken
    );
    const postings = data.truckPostings ?? data.postings ?? data;
    if (Array.isArray(postings)) {
      const existing = postings.find(
        (p: { truckId: string }) => p.truckId === truckId
      );
      if (existing) return existing.id;
    }
  }

  // Get a valid origin city
  const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations?limit=1`);
  const locations = await locRes.json();
  const originCityId = (
    locations[0] ??
    locations.locations?.[0] ??
    locations.cities?.[0]
  )?.id;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { status, data: created } = await apiCall(
    "POST",
    "/api/truck-postings",
    carrierToken,
    {
      truckId,
      originCityId,
      availableFrom: tomorrow.toISOString(),
      contactName: "Test Carrier",
      contactPhone: "+251912345678",
    }
  );
  if (status !== 201) {
    throw new Error(`Failed to create posting: ${JSON.stringify(created)}`);
  }
  return created.id ?? created.posting?.id;
}

/** Create a full carrier trip: load → carrier load-request → shipper approval → trip. */
export async function ensureCarrierTrip(
  carrierToken: string,
  shipperToken: string,
  _adminToken: string
): Promise<{ tripId: string; loadId: string; truckId: string }> {
  // Ensure we have a truck
  const { truckId } = await ensureTruck(carrierToken);

  // Create a fresh load as shipper
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fiveDays = new Date();
  fiveDays.setDate(fiveDays.getDate() + 5);

  const { status: loadStatus, data: loadData } = await apiCall(
    "POST",
    "/api/loads",
    shipperToken,
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow.toISOString().split("T")[0],
      deliveryDate: fiveDays.toISOString().split("T")[0],
      truckType: "FLATBED",
      weight: 5000,
      description: "E2E carrier deep test load",
      status: "POSTED",
    }
  );
  if (loadStatus !== 201) {
    throw new Error(
      `ensureCarrierTrip: load creation failed: ${JSON.stringify(loadData)}`
    );
  }
  const loadId = loadData.load?.id ?? loadData.id;

  // Carrier requests the load
  const { status: reqStatus, data: reqData } = await apiCall(
    "POST",
    "/api/load-requests",
    carrierToken,
    { loadId, truckId, notes: "E2E carrier deep test request" }
  );
  if (reqStatus !== 201) {
    throw new Error(
      `ensureCarrierTrip: request failed (${reqStatus}): ${JSON.stringify(reqData)}`
    );
  }
  const requestId =
    reqData.loadRequest?.id ?? reqData.request?.id ?? reqData.id;

  // Shipper approves
  const { status: appStatus, data: appData } = await apiCall(
    "POST",
    `/api/load-requests/${requestId}/respond`,
    shipperToken,
    { action: "APPROVE" }
  );
  if (appStatus !== 200) {
    throw new Error(
      `ensureCarrierTrip: approval failed (${appStatus}): ${JSON.stringify(appData)}`
    );
  }
  const tripId = appData.trip?.id;
  if (!tripId) {
    throw new Error("ensureCarrierTrip: no tripId in approval response");
  }

  return { tripId, loadId, truckId };
}

/** Advance a trip through the state machine. */
export async function progressTrip(
  carrierToken: string,
  tripId: string,
  toStatus: "PICKUP_PENDING" | "IN_TRANSIT" | "DELIVERED"
) {
  const transitions: Array<{
    from: string;
    to: string;
  }> = [
    { from: "ASSIGNED", to: "PICKUP_PENDING" },
    { from: "PICKUP_PENDING", to: "IN_TRANSIT" },
    { from: "IN_TRANSIT", to: "DELIVERED" },
  ];

  for (const t of transitions) {
    const { status } = await apiCall(
      "PATCH",
      `/api/trips/${tripId}`,
      carrierToken,
      { status: t.to }
    );
    if (status !== 200) break;
    if (t.to === toStatus) break;
  }
}

// ── Assertion helpers ────────────────────────────────────────────────

export async function expectHeading(page: Page, name: string | RegExp) {
  await expect(page.getByRole("heading", { name }).first()).toBeVisible({
    timeout: 10000,
  });
}

export async function expectNumericText(page: Page, label: string) {
  const card = page.getByText(label).first();
  await expect(card).toBeVisible({ timeout: 10000 });
}
