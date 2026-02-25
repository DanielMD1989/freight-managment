/**
 * Shared test utilities for dispatcher deep E2E tests.
 *
 * Reuses the token-cache infrastructure from admin/carrier/shipper test-utils
 * and adds dispatcher-specific data factories.
 */

import { Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

export const BASE_URL = "http://localhost:3000";
export const TEST_PASSWORD = "Test123!";
export const DISPATCHER_PASSWORD = "password";

// ── Token cache (shared with other role tests) ──────────────────────

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

export function getDispatcherToken() {
  return getToken("dispatcher@test.com", DISPATCHER_PASSWORD);
}

export function getShipperToken() {
  return getToken("shipper@test.com");
}

export function getCarrierToken() {
  return getToken("carrier@test.com");
}

export function getAdminToken() {
  return getToken("admin@test.com");
}

// ── Dispatcher-specific data factories ──────────────────────────────

/** Find or create a POSTED load for dispatcher matching tests. */
export async function ensurePostedLoad(shipperToken: string): Promise<string> {
  // Check for existing POSTED loads first
  const { data } = await apiCall(
    "GET",
    "/api/loads?myLoads=true&status=POSTED",
    shipperToken
  );
  const existing = data.loads ?? data;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing[0].id;
  }

  // Create a new load as shipper
  const { status, data: created } = await apiCall(
    "POST",
    "/api/loads",
    shipperToken,
    {
      cargoType: "General Merchandise",
      weight: 5000,
      truckType: "DRY_BOX",
      pickupCity: "Addis Ababa",
      pickupRegion: "Addis Ababa",
      pickupAddress: "Bole Road",
      deliveryCity: "Dire Dawa",
      deliveryRegion: "Dire Dawa",
      deliveryAddress: "Main Street",
      pickupDate: new Date(Date.now() + 86400000).toISOString(),
      deliveryDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      offeredRate: 25000,
      currency: "ETB",
      description: "E2E dispatcher test load",
    }
  );

  if (status !== 201) {
    throw new Error(`Failed to create load: ${JSON.stringify(created)}`);
  }

  const load = created.load ?? created;
  return load.id;
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

/** Wait for main content to be loaded (not just sidebar). */
export async function waitForMainContent(page: Page) {
  // Avoid networkidle — dispatcher pages have polling that never settles
  await page.waitForLoadState("domcontentloaded");
  const main = page.getByRole("main");
  await expect(main).toBeVisible({ timeout: 10000 });
}
