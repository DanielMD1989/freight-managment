/**
 * Deep Driver Data Integrity E2E Tests
 *
 * Verifies the UI renders EXACTLY what the API returns.
 * ZERO hardcoded expected values — every assertion compares
 * live API response to page content.
 *
 * Pattern for every test:
 *   1. Fetch real data from API (with the correct role's Bearer token)
 *   2. Navigate to the corresponding page in Chromium
 *   3. Verify the page contains the EXACT value from step 1
 *
 * Real PostgreSQL, real Chromium, real auth. No mocks.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  apiCall,
  getCarrierToken,
  getShipperToken,
  getAdminToken,
} from "./test-utils";
import { getDispatcherToken } from "../dispatcher/test-utils";

// ── Types (shape of the API responses we read) ──────────────────────────────

interface DriverProfile {
  cdlNumber: string | null;
  cdlState: string | null;
  isAvailable: boolean;
}

interface DriverUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email?: string | null;
  status?: string;
  driverProfile?: DriverProfile | null;
}

interface TripApi {
  id: string;
  status: string;
  driverId: string | null;
  carrierId: string;
  shipperId: string;
  driver?: DriverUser | null;
  load?: { pickupCity?: string; deliveryCity?: string } | null;
}

interface DashboardApi {
  activeDrivers?: number;
  availableDrivers?: number;
  tripsWithDriver?: number;
}

// ── Shared state populated in beforeAll ─────────────────────────────────────

let carrierToken: string;
let shipperToken: string;
let adminToken: string;
let dispatcherToken: string;

let driver: DriverUser | null = null;
let driverFullName: string | null = null;

let trip: TripApi | null = null;
let tripId: string | null = null;

let dashboard: DashboardApi | null = null;

/** Fullname from first + last, filtering null/empty. Returns null if nothing. */
function fullName(
  u: { firstName?: string | null; lastName?: string | null } | null | undefined
): string | null {
  if (!u) return null;
  const joined = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return joined || null;
}

/**
 * Re-fetch a trip-with-driver live at test time. beforeAll captures one trip,
 * but in the full suite earlier specs can progress that trip to COMPLETED or
 * CANCELLED, which may hide it from some pages. This helper always returns a
 * currently-usable trip with driver info attached, or null if none exists.
 */
async function findActiveTripWithDriver(
  token: string
): Promise<TripApi | null> {
  const { data } = await apiCall("GET", "/api/trips?limit=200", token);
  const trips = ((data as { trips?: TripApi[] }).trips ??
    (data as TripApi[])) as TripApi[];
  if (!Array.isArray(trips)) return null;

  // Prefer non-terminal trips so list pages (which filter by active status)
  // still show it. Fall back to any trip with a driver if no active ones.
  const active = trips.filter(
    (t) => t.driverId && t.status !== "COMPLETED" && t.status !== "CANCELLED"
  );
  const pool = active.length > 0 ? active : trips.filter((t) => t.driverId);
  if (pool.length === 0) return null;

  // Fetch detail for the first candidate so driver relation is populated.
  for (const candidate of pool) {
    const { data: detail } = await apiCall(
      "GET",
      `/api/trips/${candidate.id}`,
      token
    );
    const t = (detail as { trip?: TripApi }).trip ?? (detail as TripApi);
    if (t?.driver) return t;
  }
  return null;
}

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    carrierToken = await getCarrierToken();
    shipperToken = await getShipperToken();
    adminToken = await getAdminToken();
    dispatcherToken = await getDispatcherToken();
  } catch (err) {
    console.warn("[DI] token setup failed:", err);
    return;
  }

  // Pick the most useful driver — the seeded driver@test.com with a DriverProfile.
  // If not found, fall back to the first driver in the list.
  try {
    const { data } = await apiCall(
      "GET",
      "/api/drivers?limit=50",
      carrierToken
    );
    const list =
      (data as { drivers?: DriverUser[] }).drivers ?? (data as DriverUser[]);
    if (Array.isArray(list) && list.length > 0) {
      const seeded = list.find((d) => d.email === "driver@test.com");
      const picked =
        seeded ?? list.find((d) => !!d.driverProfile?.cdlNumber) ?? list[0];
      if (picked?.id) {
        // Re-fetch detail for full driverProfile
        const { data: detailData } = await apiCall(
          "GET",
          `/api/drivers/${picked.id}`,
          carrierToken
        );
        driver = (detailData as DriverUser).id
          ? (detailData as DriverUser)
          : picked;
        driverFullName = fullName(driver);
      }
    }
  } catch (err) {
    console.warn("[DI] driver fetch failed:", err);
  }

  // Find a trip (any status) that has a driver assigned — so we can validate
  // trip pages across all 4 portals.
  try {
    const { data } = await apiCall("GET", "/api/trips?limit=100", carrierToken);
    const trips = ((data as { trips?: TripApi[] }).trips ??
      (data as TripApi[])) as TripApi[];
    if (Array.isArray(trips)) {
      // Prefer a trip where driverId matches our picked driver, else any trip with a driver.
      const match =
        (driver?.id && trips.find((t) => t.driverId === driver!.id)) ||
        trips.find((t) => !!t.driverId);
      if (match?.id) {
        // Fetch detail so we get `driver` relation (list may not include it).
        const { data: tripDetail } = await apiCall(
          "GET",
          `/api/trips/${match.id}`,
          carrierToken
        );
        const unwrapped =
          (tripDetail as { trip?: TripApi }).trip ?? (tripDetail as TripApi);
        trip = unwrapped;
        tripId = unwrapped?.id ?? null;
      }
    }
  } catch (err) {
    console.warn("[DI] trip fetch failed:", err);
  }

  // Carrier dashboard stats
  try {
    const { data } = await apiCall(
      "GET",
      "/api/carrier/dashboard",
      carrierToken
    );
    dashboard = data as DashboardApi;
  } catch (err) {
    console.warn("[DI] dashboard fetch failed:", err);
  }
});

test.afterAll(async () => {
  // Safety: if DI-19 mutated isAvailable and left it wrong, restore.
  if (!driver?.id || !carrierToken) return;
  try {
    const { data } = await apiCall(
      "GET",
      `/api/drivers/${driver.id}`,
      carrierToken
    );
    const cur = (data as DriverUser).driverProfile?.isAvailable;
    if (cur !== driver.driverProfile?.isAvailable) {
      await apiCall("PUT", `/api/drivers/${driver.id}`, carrierToken, {
        isAvailable: driver.driverProfile?.isAvailable ?? true,
      });
    }
  } catch {
    /* best effort */
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 1 — Carrier driver list + detail
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 1: Carrier driver list + detail", () => {
  test("DI-1 driver list: name from API matches page", async ({ page }) => {
    test.skip(!driver || !driverFullName, "no driver data");
    await page.goto("/carrier/drivers");
    await page.waitForTimeout(2000);
    await expect(page.getByText(driverFullName!).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("DI-2 driver detail: CDL number from API matches page", async ({
    page,
  }) => {
    test.skip(!driver?.id, "no driver data");
    const cdl = driver!.driverProfile?.cdlNumber;
    test.skip(!cdl, "driver has no CDL number");
    await page.goto(`/carrier/drivers/${driver!.id}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(cdl!).first()).toBeVisible({ timeout: 10000 });
  });

  test("DI-3 driver detail: phone from API matches page", async ({ page }) => {
    test.skip(!driver?.id || !driver.phone, "no driver/phone");
    await page.goto(`/carrier/drivers/${driver!.id}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(driver!.phone!).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("DI-4 driver detail: availability from API matches page", async ({
    page,
  }) => {
    test.skip(!driver?.id || !driver.driverProfile, "no driverProfile");
    const expected = driver!.driverProfile!.isAvailable
      ? /Available/
      : /Unavailable/;
    await page.goto(`/carrier/drivers/${driver!.id}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(expected).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 2 — Carrier trip detail
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 2: Carrier trip detail", () => {
  test("DI-5 carrier trip: driver name from API matches page", async ({
    page,
  }) => {
    test.skip(!tripId, "no trip");
    const name = fullName(trip?.driver);
    test.skip(!name, "trip has no driver name");
    await page.goto(`/carrier/trips/${tripId}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(name!).first()).toBeVisible({ timeout: 10000 });
  });

  test("DI-6 carrier trip: driver phone from API matches page", async ({
    page,
  }) => {
    test.skip(!tripId || !trip?.driver?.phone, "no trip/phone");
    await page.goto(`/carrier/trips/${tripId}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(trip!.driver!.phone!).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("DI-7 carrier trip list: driver name appears on page", async ({
    page,
  }) => {
    // Live API lookup — earlier specs may have progressed our beforeAll trip
    // past terminal status, and /carrier/trips paginates so a specific trip
    // might not be on page 1. Instead, require that SOME trip with a driver
    // has its name visible in the list — which is what this screen promises.
    const live = await findActiveTripWithDriver(carrierToken);
    test.skip(!live, "no trip with driver available right now");
    const name = fullName(live!.driver);
    test.skip(!name, "live trip has no driver name");
    await page.goto("/carrier/trips");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page.getByText(name!).first()).toBeVisible({ timeout: 15000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 3 — Shipper trip detail (shipper storageState)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 3: Shipper trip detail", () => {
  test.use({ storageState: "e2e/.auth/shipper.json" });

  test("DI-8 shipper trip: driver name from API matches page", async ({
    page,
  }) => {
    // Live API lookup — avoids relying on beforeAll's captured trip, which
    // earlier specs may have mutated.
    const live = await findActiveTripWithDriver(shipperToken);
    test.skip(!live, "no trip with driver visible to shipper");
    const name = fullName(live!.driver);
    test.skip(!name, "shipper API didn't return driver name");
    await page.goto(`/shipper/trips/${live!.id}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
    await expect(page.getByText(name!).first()).toBeVisible({ timeout: 15000 });
  });

  test("DI-9 shipper trip: driver phone from API matches page", async ({
    page,
  }) => {
    const live = await findActiveTripWithDriver(shipperToken);
    test.skip(!live, "no trip with driver visible to shipper");
    const phone = live!.driver?.phone;
    test.skip(!phone, "shipper API didn't return driver phone");
    await page.goto(`/shipper/trips/${live!.id}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
    await expect(page.getByText(phone!).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 4 — Dispatcher
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 4: Dispatcher", () => {
  test.use({ storageState: "e2e/.auth/dispatcher.json" });

  test("DI-10 dispatcher trip detail: driver name matches API", async ({
    page,
  }) => {
    test.skip(!tripId, "no trip");
    const { data: tripDetail } = await apiCall(
      "GET",
      `/api/trips/${tripId}`,
      dispatcherToken
    );
    const t =
      (tripDetail as { trip?: TripApi }).trip ?? (tripDetail as TripApi);
    const name = fullName(t?.driver);
    test.skip(!name, "dispatcher API didn't return driver name");
    await page.goto(`/dispatcher/trips/${tripId}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(name!).first()).toBeVisible({ timeout: 10000 });
  });

  test("DI-11 dispatcher trip list: driver name visible on page", async ({
    page,
  }) => {
    test.skip(!tripId, "no trip");
    const name = fullName(trip?.driver);
    test.skip(!name, "no driver name");
    await page.goto("/dispatcher/trips");
    await page.waitForTimeout(2500);
    await expect(page.getByText(name!).first()).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 5 — Admin
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 5: Admin trip detail", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("DI-12 admin trip detail: driver name matches API", async ({ page }) => {
    test.skip(!tripId, "no trip");
    const { data: tripDetail } = await apiCall(
      "GET",
      `/api/trips/${tripId}`,
      adminToken
    );
    const t =
      (tripDetail as { trip?: TripApi }).trip ?? (tripDetail as TripApi);
    const name = fullName(t?.driver);
    test.skip(!name, "admin API didn't return driver name");
    await page.goto(`/admin/trips/${tripId}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(name!).first()).toBeVisible({ timeout: 10000 });
  });

  test("DI-13 admin trip detail: driver availability matches API", async ({
    page,
  }) => {
    test.skip(!tripId, "no trip");
    const { data: tripDetail } = await apiCall(
      "GET",
      `/api/trips/${tripId}`,
      adminToken
    );
    const t =
      (tripDetail as { trip?: TripApi }).trip ?? (tripDetail as TripApi);
    const isAvail = t?.driver?.driverProfile?.isAvailable;
    test.skip(isAvail === undefined, "admin API no driverProfile.isAvailable");
    const expected = isAvail ? /Available/ : /Unavailable/;
    await page.goto(`/admin/trips/${tripId}`);
    await page.waitForTimeout(2000);
    await expect(page.getByText(expected).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 6 — Cross-role consistency
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 6: Cross-role consistency", () => {
  test("DI-14 same driver name/phone across all 4 role APIs", async () => {
    test.skip(!tripId, "no trip");
    const tokens = [
      { role: "carrier", token: carrierToken },
      { role: "shipper", token: shipperToken },
      { role: "admin", token: adminToken },
      { role: "dispatcher", token: dispatcherToken },
    ];
    const snapshots: {
      role: string;
      name: string | null;
      phone: string | null;
    }[] = [];
    for (const { role, token } of tokens) {
      const { data, status } = await apiCall(
        "GET",
        `/api/trips/${tripId}`,
        token
      );
      if (status !== 200) continue;
      const t = (data as { trip?: TripApi }).trip ?? (data as TripApi);
      snapshots.push({
        role,
        name: fullName(t?.driver),
        phone: t?.driver?.phone ?? null,
      });
    }
    test.skip(snapshots.length < 2, "<2 role APIs returned 200");
    // All captured snapshots must agree
    const [first, ...rest] = snapshots;
    for (const s of rest) {
      expect(
        s.name,
        `driver name mismatch: ${first.role}=${first.name} vs ${s.role}=${s.name}`
      ).toBe(first.name);
      expect(
        s.phone,
        `driver phone mismatch: ${first.role}=${first.phone} vs ${s.role}=${s.phone}`
      ).toBe(first.phone);
    }
  });

  test("DI-15 same driver name across all 4 role PAGES", async ({
    browser,
  }) => {
    test.setTimeout(120000);
    // Live lookup — earlier specs may have mutated the beforeAll trip
    const live = await findActiveTripWithDriver(carrierToken);
    test.skip(!live, "no trip with driver right now");
    const name = fullName(live!.driver);
    test.skip(!name, "no driver name");

    const visits: Array<{ role: string; storage: string; url: string }> = [
      {
        role: "carrier",
        storage: "e2e/.auth/carrier.json",
        url: `/carrier/trips/${live!.id}`,
      },
      {
        role: "shipper",
        storage: "e2e/.auth/shipper.json",
        url: `/shipper/trips/${live!.id}`,
      },
      {
        role: "dispatcher",
        storage: "e2e/.auth/dispatcher.json",
        url: `/dispatcher/trips/${live!.id}`,
      },
      {
        role: "admin",
        storage: "e2e/.auth/admin.json",
        url: `/admin/trips/${live!.id}`,
      },
    ];

    for (const v of visits) {
      const ctx = await browser.newContext({ storageState: v.storage });
      const page: Page = await ctx.newPage();
      try {
        await page.goto(v.url);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1000);
        await expect(
          page.getByText(name!).first(),
          `driver name missing on ${v.role} page`
        ).toBeVisible({ timeout: 15000 });
      } finally {
        await page.close();
        await ctx.close();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 7 — Dashboard stats
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 7: Carrier dashboard stats", () => {
  test("DI-16 dashboard: activeDrivers matches API", async ({ page }) => {
    test.skip(!dashboard, "no dashboard data");
    const v = dashboard!.activeDrivers;
    test.skip(v === undefined || v === 0, "no activeDrivers (card hidden)");
    await page.goto("/carrier/dashboard");
    await page.waitForTimeout(2000);
    // StatCard renders the number as standalone text near "Active Drivers"
    await expect(page.getByText(/Active Drivers/i).first()).toBeVisible();
    await expect(
      page.getByText(String(v), { exact: true }).first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("DI-17 dashboard: availableDrivers matches API", async ({ page }) => {
    test.skip(!dashboard, "no dashboard data");
    const v = dashboard!.availableDrivers;
    test.skip(v === undefined, "no availableDrivers in API");
    test.skip(
      (dashboard!.activeDrivers ?? 0) === 0,
      "driver stats card hidden when no active drivers"
    );
    await page.goto("/carrier/dashboard");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Available Drivers/i).first()).toBeVisible();
    await expect(
      page.getByText(String(v), { exact: true }).first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("DI-18 dashboard: tripsWithDriver matches API", async ({ page }) => {
    test.skip(!dashboard, "no dashboard data");
    const v = dashboard!.tripsWithDriver;
    test.skip(v === undefined, "no tripsWithDriver in API");
    test.skip(
      (dashboard!.activeDrivers ?? 0) === 0,
      "driver stats card hidden when no active drivers"
    );
    await page.goto("/carrier/dashboard");
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Trips with Driver/i).first()).toBeVisible();
    await expect(
      page.getByText(String(v), { exact: true }).first()
    ).toBeVisible({
      timeout: 10000,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 8 — Mutation reflects immediately
// ═══════════════════════════════════════════════════════════════════════════

test.describe("DI Group 8: Mutation reflects on page", () => {
  test("DI-19 availability toggle: API change reflects on page", async ({
    page,
  }) => {
    test.skip(!driver?.id || !driver.driverProfile, "no driverProfile");
    const original = driver!.driverProfile!.isAvailable;
    const flipped = !original;

    // Flip via API
    const toggleRes = await apiCall(
      "PUT",
      `/api/drivers/${driver!.id}`,
      carrierToken,
      { isAvailable: flipped }
    );
    test.skip(toggleRes.status !== 200, `PUT returned ${toggleRes.status}`);

    try {
      await page.goto(`/carrier/drivers/${driver!.id}`);
      await page.waitForTimeout(2000);
      const expected = flipped ? /Available/ : /Unavailable/;
      await expect(page.getByText(expected).first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      // Restore
      await apiCall("PUT", `/api/drivers/${driver!.id}`, carrierToken, {
        isAvailable: original,
      }).catch(() => {});
    }
  });

  test("DI-20 driver list count matches API", async ({ page }) => {
    test.skip(!carrierToken, "no token");
    const { data } = await apiCall(
      "GET",
      "/api/drivers?limit=100",
      carrierToken
    );
    const list =
      (data as { drivers?: DriverUser[] }).drivers ?? (data as DriverUser[]);
    test.skip(!Array.isArray(list) || list.length === 0, "no drivers in API");

    await page.goto("/carrier/drivers");
    await page.waitForTimeout(2500);

    // Every driver in the API must appear on the list page (by full name or phone)
    // Count how many we can find — assert it equals API length.
    let matched = 0;
    for (const d of list) {
      const name = fullName(d);
      const marker = name ?? d.phone ?? d.email;
      if (!marker) continue;
      const locator = page.getByText(marker).first();
      if (await locator.isVisible().catch(() => false)) matched++;
    }
    expect(matched, `only ${matched} of ${list.length} drivers rendered`).toBe(
      list.length
    );
  });
});
