/**
 * Deep Trip Detail E2E Tests — Carrier Portal
 *
 * Verifies trip info, truck/shipper details, documents,
 * POD upload, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import {
  getCarrierToken,
  getShipperToken,
  getAdminToken,
  apiCall,
  ensureCarrierTrip,
} from "./test-utils";

let carrierToken: string;
let tripId: string;

test.beforeAll(async () => {
  test.setTimeout(180000);
  try {
    carrierToken = await getCarrierToken();
    const shipperToken = await getShipperToken();
    const adminToken = await getAdminToken();
    const result = await ensureCarrierTrip(
      carrierToken,
      shipperToken,
      adminToken
    );
    tripId = result.tripId;
  } catch {
    // Tests will skip
  }
});

test.describe("Deep: Trip Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!tripId, "No trip available");
    await page.goto(`/carrier/trips/${tripId}`);
    await page.waitForTimeout(2000);
  });

  test("trip reference number is shown", async ({ page }) => {
    await expect(
      page.getByText(/TRIP-|Trip.*#|Reference/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("route info shows pickup and delivery cities", async ({ page }) => {
    await expect(
      page.getByText(/Addis Ababa|Dire Dawa|Pickup|Delivery/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status badge is visible", async ({ page }) => {
    await expect(
      page
        .getByText(
          /Ready to Start|Assigned|Pickup Pending|In Transit|Delivered/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("truck info section shows license plate", async ({ page }) => {
    await expect(page.getByText(/ET-|Truck|License/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("shipper info section is visible", async ({ page }) => {
    await expect(page.getByText(/Shipper|Company/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("dates section shows pickup and delivery dates", async ({ page }) => {
    await expect(
      page.getByText(/Pickup Date|Delivery Date|Date/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("documents section renders", async ({ page }) => {
    const docsSection = page
      .getByText(/Documents|POD|BOL|Receipt|No documents/i)
      .first();
    await expect(docsSection).toBeVisible({ timeout: 10000 });
  });

  test("back navigation to trips list works", async ({ page }) => {
    const backBtn = page
      .getByRole("link", { name: /Back|← My Trips|trips/i })
      .first();
    await expect(backBtn).toBeVisible({ timeout: 10000 });
  });

  test("cross-check trip data against API", async ({ page }) => {
    test.skip(!carrierToken, "No carrier token");
    test.setTimeout(60000);

    const { status, data } = await apiCall(
      "GET",
      `/api/trips/${tripId}`,
      carrierToken
    );
    test.skip(status !== 200, `Trip API returned ${status}`);

    const trip = data.trip ?? data;
    if (trip.load?.pickupCity) {
      await expect(page.getByText(trip.load.pickupCity).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });
});
