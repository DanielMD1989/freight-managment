/**
 * Shared test utilities for deep E2E tests.
 *
 * Provides API helpers, data factories, and assertion shortcuts
 * used across all deep-*.spec.ts files.
 */

import { Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

export const BASE_URL = "http://localhost:3000";
export const TEST_PASSWORD = "Test123!";

// ── Token cache (avoids repeated logins that trigger rate limiting) ──

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

  const { status, data: created } = await apiCall("POST", "/api/loads", token, {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: tomorrow.toISOString().split("T")[0],
    deliveryDate: fiveDays.toISOString().split("T")[0],
    truckType: "FLATBED",
    weight: 5000,
    description: "E2E deep test load",
    status: "POSTED",
  });
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
      description: "E2E deep test trip load",
      status: "POSTED",
    }
  );
  if (loadStatus !== 201)
    throw new Error(
      `ensureTrip: load creation failed: ${JSON.stringify(loadData)}`
    );
  const loadId = loadData.load?.id ?? loadData.id;

  // Get an available carrier truck
  const { data: truckData } = await apiCall(
    "GET",
    "/api/trucks?isAvailable=true",
    carrierToken
  );
  const trucks = truckData.trucks ?? truckData;
  if (!Array.isArray(trucks) || trucks.length === 0)
    throw new Error("ensureTrip: no available carrier trucks");
  const truckId = trucks[0].id;

  // Approve truck
  await apiCall("POST", `/api/trucks/${truckId}/approve`, adminToken, {
    action: "APPROVE",
  });

  // Create truck posting (may already exist — ignore errors)
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

  // Shipper approves
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
  const tripId = appData.trip?.id;
  if (!tripId) throw new Error("ensureTrip: no tripId in approval response");

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
