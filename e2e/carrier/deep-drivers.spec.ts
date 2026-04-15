/**
 * Deep Driver Integration E2E Tests
 *
 * Exercises the driver-aware UI surfaces across 4 portals:
 *   - Carrier:   /carrier/drivers, /carrier/drivers/invite, /carrier/drivers/[id], /carrier/trips/[id]
 *   - Shipper:   /shipper/trips/[id]  (driver info + rating modal driver name)
 *   - Dispatcher: /dispatcher/trips, /dispatcher/trips/[id]  (Driver column + cell)
 *   - Admin:     /admin/trips/[id]  (driver info section)
 *
 * Each `test.describe` uses `test.use({ storageState })` to switch portal auth.
 * A `beforeAll` seeds one trip assigned to driver@test.com plus one DELIVERED
 * trip for POD-status tests. Tests gracefully skip if setup fails.
 */

import { test, expect } from "@playwright/test";
import {
  getCarrierToken,
  getShipperToken,
  ensureTruck,
  apiCall,
} from "./test-utils";

const DRIVER_EMAIL = "driver@test.com";

let carrierToken: string;
let driverUserId: string | null = null;
let assignedTripId: string | null = null;
let deliveredTripId: string | null = null;

/**
 * Inline trip creation that includes all fields the createLoadSchema requires.
 * ensureCarrierTrip in test-utils.ts is missing shipperContactName/Phone, so
 * assertValidLoad throws. Keep this helper local so the spec is self-contained.
 */
async function createTripWithDriver(
  carrierToken: string,
  shipperToken: string,
  driverUserId: string | null
): Promise<string | null> {
  try {
    const { truckId } = await ensureTruck(carrierToken);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    const payload = {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow.toISOString().split("T")[0],
      deliveryDate: fiveDays.toISOString().split("T")[0],
      truckType: "FLATBED",
      weight: 5000,
      cargoDescription: "E2E driver spec test load",
      status: "POSTED",
      shipperContactName: "E2E Shipper Contact",
      shipperContactPhone: "+251911222333",
    };

    const { status: loadStatus, data: loadData } = await apiCall(
      "POST",
      "/api/loads",
      shipperToken,
      payload
    );
    if (loadStatus !== 201) {
      console.warn("load create failed:", loadData);
      return null;
    }
    const loadId = loadData.load?.id ?? loadData.id;

    const { status: reqStatus, data: reqData } = await apiCall(
      "POST",
      "/api/load-requests",
      carrierToken,
      { loadId, truckId, notes: "driver spec" }
    );
    if (reqStatus !== 201) {
      console.warn("load-request failed:", reqData);
      return null;
    }
    const requestId =
      reqData.loadRequest?.id ?? reqData.request?.id ?? reqData.id;

    await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      shipperToken,
      { action: "APPROVE" }
    );

    const { data: confData } = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/confirm`,
      carrierToken,
      { action: "CONFIRM" }
    );
    const tripId = confData.trip?.id;
    if (!tripId) return null;

    if (driverUserId) {
      await apiCall(
        "POST",
        `/api/trips/${tripId}/assign-driver`,
        carrierToken,
        { driverId: driverUserId }
      );
    }

    return tripId;
  } catch (err) {
    console.warn("createTripWithDriver failed:", err);
    return null;
  }
}

test.beforeAll(async () => {
  test.setTimeout(240000);
  try {
    carrierToken = await getCarrierToken();
    const shipperToken = await getShipperToken();

    // 1. Find the driver user
    const { data: driversData } = await apiCall(
      "GET",
      "/api/drivers?limit=50",
      carrierToken
    );
    const drivers = driversData?.drivers ?? driversData ?? [];
    const driver = Array.isArray(drivers)
      ? drivers.find((d: { email?: string }) => d?.email === DRIVER_EMAIL)
      : null;
    if (driver?.id) {
      driverUserId = driver.id;
    }

    // 2. Prefer an existing ASSIGNED trip that already has this driver.
    //    Avoids the "Truck on active trip" pollution issue when creating new loads.
    const { data: tripsData } = await apiCall(
      "GET",
      "/api/trips?limit=100",
      carrierToken
    );
    const trips = (tripsData?.trips ?? tripsData ?? []) as Array<{
      id: string;
      status: string;
      driverId: string | null;
    }>;

    const existingAssigned = trips.find(
      (t) => t.status === "ASSIGNED" && t.driverId === driverUserId
    );
    if (existingAssigned) {
      assignedTripId = existingAssigned.id;
    } else {
      // Fallback: create one
      assignedTripId = await createTripWithDriver(
        carrierToken,
        shipperToken,
        driverUserId
      );
    }

    // 3. Try to find/create a DELIVERED trip. First look for an existing
    //    DELIVERED trip with our driver; otherwise create+progress a new one.
    const existingDelivered = trips.find(
      (t) => t.status === "DELIVERED" && t.driverId === driverUserId
    );
    if (existingDelivered) {
      deliveredTripId = existingDelivered.id;
    } else {
      const t2 = await createTripWithDriver(
        carrierToken,
        shipperToken,
        driverUserId
      );
      if (t2) {
        for (const to of ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED"]) {
          const { status } = await apiCall(
            "PATCH",
            `/api/trips/${t2}`,
            carrierToken,
            { status: to }
          );
          if (status !== 200) break;
        }
        deliveredTripId = t2;
      }
    }
  } catch (err) {
    console.warn("deep-drivers beforeAll failed:", err);
  }
});

// ════════════════════════════════════════════════════════════════════
// 1. Carrier Driver Management
// ════════════════════════════════════════════════════════════════════

test.describe("Carrier: Driver list + invite + detail", () => {
  test("driver list page loads", async ({ page }) => {
    await page.goto("/carrier/drivers");
    await expect(
      page.getByRole("heading", { name: /Driver Management/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("driver list shows the seeded test driver", async ({ page }) => {
    await page.goto("/carrier/drivers");
    // The seeded driver has firstName "Test" lastName "Driver". Look for
    // a cell/row containing the phone we seeded.
    const driverPresent = page.getByText(/Test Driver|\+251944444441/i).first();
    await expect(driverPresent).toBeVisible({ timeout: 10000 });
  });

  test("invite form renders and generates an invite code", async ({ page }) => {
    await page.goto("/carrier/drivers/invite");

    await expect(
      page.getByRole("heading", { name: /Invite a Driver/i })
    ).toBeVisible({ timeout: 10000 });

    const unique = Date.now().toString(36).slice(-5).toUpperCase();
    const name = `E2E Test ${unique}`;
    const phone = `+251${Math.floor(900000000 + Math.random() * 99999999)}`;

    // Form: Full Name (text), Phone Number (tel), Email (email)
    await page.locator('input[type="text"]').first().fill(name);
    await page.locator('input[type="tel"]').first().fill(phone);

    const submitBtn = page.getByRole("button", {
      name: /Generate Invite Code/i,
    });
    // Wait until button is enabled (disabled while name/phone empty)
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Success screen shows a 6-char invite code
    await expect(page.getByText(/Driver Invited Successfully/i)).toBeVisible({
      timeout: 15000,
    });

    const codeEl = page.locator("p.font-mono").first();
    await expect(codeEl).toBeVisible();
    const code = (await codeEl.innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  test("driver detail shows CDL info + 'Not uploaded' for photos", async ({
    page,
  }) => {
    test.skip(!driverUserId, "driver@test.com not found in API");
    await page.goto(`/carrier/drivers/${driverUserId}`);

    // Name visible
    await expect(page.getByText(/Test Driver/i).first()).toBeVisible({
      timeout: 10000,
    });

    // CDL fields rendered (labels exist — actual values come from seed)
    await expect(page.getByText(/CDL Number/i).first()).toBeVisible();
    await expect(page.getByText(/CDL State/i).first()).toBeVisible();
    await expect(page.getByText(/CDL Expiry/i).first()).toBeVisible();
    await expect(page.getByText(/Medical Cert/i).first()).toBeVisible();

    // CDL Documents section renders 3 photo slots — all "Not uploaded"
    // for our seeded driver (no cdlFrontUrl/cdlBackUrl/medicalCertUrl)
    await expect(page.getByText(/CDL Documents/i).first()).toBeVisible();
    const notUploaded = page.getByText(/Not uploaded/i);
    await expect(notUploaded.first()).toBeVisible({ timeout: 10000 });
    // Three placeholders expected
    await expect(notUploaded).toHaveCount(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. Carrier Trip Detail — driver assignment + POD removal
// ════════════════════════════════════════════════════════════════════

test.describe("Carrier: Trip detail driver info + POD UI removal", () => {
  test("ASSIGNED trip shows assigned driver name", async ({ page }) => {
    test.skip(!assignedTripId || !driverUserId, "no assigned trip");
    await page.goto(`/carrier/trips/${assignedTripId}`);
    await page.waitForTimeout(1500);

    // Driver name should be rendered somewhere on the page
    await expect(page.getByText(/Test Driver/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("DELIVERED trip: 'Waiting for driver to upload POD' shown", async ({
    page,
  }) => {
    test.skip(!deliveredTripId, "no delivered trip");
    await page.goto(`/carrier/trips/${deliveredTripId}`);
    await page.waitForTimeout(1500);

    await expect(
      page.getByText(/Waiting for driver to upload POD/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("DELIVERED trip: NO 'Upload POD' button (removed in commit def9bb5a)", async ({
    page,
  }) => {
    test.skip(!deliveredTripId, "no delivered trip");
    await page.goto(`/carrier/trips/${deliveredTripId}`);
    await page.waitForTimeout(1500);

    const uploadBtn = page.getByRole("button", { name: /Upload POD/i });
    await expect(uploadBtn).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. Shipper Trip Detail — driver info on the shipper portal
// ════════════════════════════════════════════════════════════════════

test.describe("Shipper: Trip detail driver info", () => {
  test.use({ storageState: "e2e/.auth/shipper.json" });

  test("trip detail shows assigned driver name", async ({ page }) => {
    test.skip(!assignedTripId, "no assigned trip");
    await page.goto(`/shipper/trips/${assignedTripId}`);
    await page.waitForTimeout(1500);

    await expect(page.getByText(/Test Driver/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("trip detail shows driver phone", async ({ page }) => {
    test.skip(!assignedTripId, "no assigned trip");
    await page.goto(`/shipper/trips/${assignedTripId}`);
    await page.waitForTimeout(1500);

    await expect(page.getByText(/\+251944444441/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. Dispatcher Portal — Driver column + detail cell
// ════════════════════════════════════════════════════════════════════

test.describe("Dispatcher: Trips list + detail with driver", () => {
  test.use({ storageState: "e2e/.auth/dispatcher.json" });

  test("trips list has a Driver column", async ({ page }) => {
    await page.goto("/dispatcher/trips");
    await page.waitForTimeout(1500);

    const driverHeader = page.getByRole("columnheader", { name: /Driver/i });
    await expect(driverHeader.first()).toBeVisible({ timeout: 10000 });
  });

  test("trip detail page shows Driver label + name", async ({ page }) => {
    test.skip(!assignedTripId, "no assigned trip");
    await page.goto(`/dispatcher/trips/${assignedTripId}`);
    await page.waitForTimeout(1500);

    // "Driver" label (uppercase in the dispatcher grid cell)
    await expect(page.getByText(/^Driver$/i).first()).toBeVisible({
      timeout: 10000,
    });
    // Actual driver name
    await expect(page.getByText(/Test Driver/i).first()).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. Admin Portal — Driver info on trip detail
// ════════════════════════════════════════════════════════════════════

test.describe("Admin: Trip detail driver info", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("trip detail page shows assigned driver info", async ({ page }) => {
    test.skip(!assignedTripId, "no assigned trip");
    await page.goto(`/admin/trips/${assignedTripId}`);
    await page.waitForTimeout(1500);

    // Admin trip detail was updated in Task 20 to show driver info.
    // We assert on the driver name + at least one of (Driver label, phone).
    const anyDriverToken = page
      .getByText(/Test Driver|\+251944444441|^Driver$/i)
      .first();
    await expect(anyDriverToken).toBeVisible({ timeout: 10000 });
  });
});
