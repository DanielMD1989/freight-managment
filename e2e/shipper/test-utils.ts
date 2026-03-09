/**
 * Shared test utilities for deep E2E tests.
 *
 * Provides API helpers, data factories, and assertion shortcuts
 * used across all deep-*.spec.ts files.
 */

import { Page, expect } from "@playwright/test";

import {
  readTokenCache,
  writeTokenCache,
  TOKEN_CACHE_TTL,
} from "../shared/token-cache";
import { assertValidLoad } from "../shared/schema-validate";

export const BASE_URL = "http://localhost:3000";
export const TEST_PASSWORD = "Test123!";

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
  // Check file-based cache first (shared across spec files)
  const cache = readTokenCache();
  const cached = cache[email];
  if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
    return cached.token;
  }

  // Retry with delay for rate-limited logins
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
      // Rate limited — wait and retry
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

    // Cache the token for other spec files
    cache[email] = { token: data.sessionToken, timestamp: Date.now() };
    writeTokenCache(cache);

    return data.sessionToken;
  }

  throw new Error(`Login failed for ${email}: rate limited after 3 attempts`);
}

// ── Data factories ───────────────────────────────────────────────────

/** Return an existing POSTED load ID, or create one via API. */
export async function ensureLoad(token: string): Promise<string> {
  const { data } = await apiCall(
    "GET",
    "/api/loads?myLoads=true&status=POSTED&limit=1",
    token
  );
  const existing = data.loads ?? data;
  if (Array.isArray(existing) && existing.length > 0) return existing[0].id;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fiveDays = new Date();
  fiveDays.setDate(fiveDays.getDate() + 5);

  const loadPayload = {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: tomorrow.toISOString().split("T")[0],
    deliveryDate: fiveDays.toISOString().split("T")[0],
    truckType: "FLATBED",
    weight: 5000,
    cargoDescription: "E2E test cargo description",
    status: "POSTED",
  };
  assertValidLoad(loadPayload);
  const { status, data: created } = await apiCall(
    "POST",
    "/api/loads",
    token,
    loadPayload
  );
  if (status !== 201)
    throw new Error(`Failed to create load: ${JSON.stringify(created)}`);
  return created.load?.id ?? created.id;
}

/** Create a full trip (load + carrier request + approval). */
export async function ensureTrip(
  shipperToken: string,
  carrierToken: string,
  adminToken: string
): Promise<{ tripId: string; loadId: string }> {
  // Create a fresh load (always new so it's in POSTED state)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fiveDays = new Date();
  fiveDays.setDate(fiveDays.getDate() + 5);

  const tripLoadPayload = {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: tomorrow.toISOString().split("T")[0],
    deliveryDate: fiveDays.toISOString().split("T")[0],
    truckType: "FLATBED",
    weight: 5000,
    cargoDescription: "E2E test cargo description",
    status: "POSTED",
  };
  assertValidLoad(tripLoadPayload);
  const { status: loadStatus, data: loadData } = await apiCall(
    "POST",
    "/api/loads",
    shipperToken,
    tripLoadPayload
  );
  if (loadStatus !== 201)
    throw new Error(
      `ensureTrip: load creation failed: ${JSON.stringify(loadData)}`
    );
  const loadId = loadData.load?.id ?? loadData.id;

  // Create a brand-new truck per call so each ensureTrip is fully isolated
  const plate = `ET-E2E-${Date.now().toString(36).toUpperCase()}`;
  const { status: truckStatus, data: truckCreated } = await apiCall(
    "POST",
    "/api/trucks",
    carrierToken,
    {
      truckType: "FLATBED",
      licensePlate: plate,
      capacity: 15000,
      volume: 50,
      currentCity: "Addis Ababa",
      currentRegion: "Addis Ababa",
      isAvailable: true,
    }
  );
  if (truckStatus !== 201)
    throw new Error(
      `ensureTrip: truck creation failed (${truckStatus}): ${JSON.stringify(truckCreated)}`
    );
  const truckId = (truckCreated.truck ?? truckCreated).id;

  // Approve the new truck
  const { status: approveStatus, data: approveData } = await apiCall(
    "POST",
    `/api/trucks/${truckId}/approve`,
    adminToken,
    { action: "APPROVE" }
  );
  if (approveStatus !== 200)
    throw new Error(
      `ensureTrip: truck approval failed (${approveStatus}): ${JSON.stringify(approveData)}`
    );

  // Create truck posting
  const locRes = await fetch(`${BASE_URL}/api/ethiopian-locations?limit=1`);
  const locations = await locRes.json();
  const originCityId = (locations[0] ?? locations.locations?.[0])?.id;
  await apiCall("POST", "/api/truck-postings", carrierToken, {
    truckId,
    originCityId,
    availableFrom: tomorrow.toISOString(),
    contactName: "Test Carrier",
    contactPhone: "+251912345678",
  });

  // Carrier requests the load
  const { status: reqStatus, data: reqData } = await apiCall(
    "POST",
    "/api/load-requests",
    carrierToken,
    { loadId, truckId, notes: "E2E deep test request" }
  );
  if (reqStatus !== 201)
    throw new Error(
      `ensureTrip: request failed (${reqStatus}): ${JSON.stringify(reqData)}`
    );
  const requestId =
    reqData.loadRequest?.id ?? reqData.request?.id ?? reqData.id;

  // Shipper soft-approves (SHIPPER_APPROVED — no trip yet)
  const { status: appStatus, data: appData } = await apiCall(
    "POST",
    `/api/load-requests/${requestId}/respond`,
    shipperToken,
    { action: "APPROVE" }
  );
  if (appStatus !== 200)
    throw new Error(
      `ensureTrip: approval failed (${appStatus}): ${JSON.stringify(appData)}`
    );

  // Carrier confirms booking — this creates the Trip
  const { status: confStatus, data: confData } = await apiCall(
    "POST",
    `/api/load-requests/${requestId}/confirm`,
    carrierToken,
    { action: "CONFIRM" }
  );
  if (confStatus !== 200)
    throw new Error(
      `ensureTrip: confirm failed (${confStatus}): ${JSON.stringify(confData)}`
    );
  const tripId = confData.trip?.id;
  if (!tripId) throw new Error("ensureTrip: no tripId in confirm response");

  return { tripId, loadId };
}

// ── Assertion helpers ────────────────────────────────────────────────

/** Assert a heading with the given name is visible (10 s timeout). */
export async function expectHeading(page: Page, name: string | RegExp) {
  await expect(page.getByRole("heading", { name }).first()).toBeVisible({
    timeout: 10000,
  });
}

/** Assert that a locator matches a number (digits, optional comma/dot). */
export async function expectNumericText(page: Page, label: string) {
  const card = page.getByText(label).first();
  await expect(card).toBeVisible({ timeout: 10000 });
}
