/**
 * Shared test utilities for admin deep E2E tests.
 *
 * Reuses the token-cache infrastructure from the carrier/shipper test-utils
 * and adds admin-specific data factories.
 */

import { Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

export const BASE_URL = "http://localhost:3000";
export const TEST_PASSWORD = "Test123!";

// ── Token cache (shared with carrier/shipper tests) ─────────────────

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

export function getAdminToken() {
  return getToken("admin@test.com");
}

export function getShipperToken() {
  return getToken("shipper@test.com");
}

export function getCarrierToken() {
  return getToken("carrier@test.com");
}

// ── Admin-specific data factories ───────────────────────────────────

/** Create a truck that needs admin approval (for truck approval tests). */
export async function ensurePendingTruck(
  carrierToken: string
): Promise<{ truckId: string; licensePlate: string }> {
  const plate = `ET-ADM-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const { status, data } = await apiCall("POST", "/api/trucks", carrierToken, {
    truckType: "FLATBED",
    licensePlate: plate,
    capacity: 15000,
    volume: 45,
    currentCity: "Addis Ababa",
    currentRegion: "Addis Ababa",
    isAvailable: true,
  });

  if (status !== 201) {
    throw new Error(`Failed to create pending truck: ${JSON.stringify(data)}`);
  }

  const truck = data.truck ?? data;
  return { truckId: truck.id, licensePlate: truck.licensePlate ?? plate };
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
  // Avoid networkidle — some admin pages have polling that never settles
  await page.waitForLoadState("domcontentloaded");
  // Wait for the main element to have content
  const main = page.getByRole("main");
  await expect(main).toBeVisible({ timeout: 10000 });
}
