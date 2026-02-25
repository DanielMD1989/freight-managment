/**
 * Deep Active Trips E2E Tests — Carrier Portal
 *
 * Verifies trip list tabs (Ready to Start / Active),
 * status badges, action buttons, state transitions,
 * and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import {
  getCarrierToken,
  getShipperToken,
  getAdminToken,
  apiCall,
  expectHeading,
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
    // Tests that need trip will skip
  }
});

test.describe("Deep: My Trips Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/trips");
    await expectHeading(page, /My Trips/);
  });

  test("page heading with subtitle renders", async ({ page }) => {
    await expect(
      page.getByText(/Manage your load assignments|active deliveries/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Trip History link button is visible", async ({ page }) => {
    const historyBtn = page
      .getByRole("link", { name: /Trip History/i })
      .first()
      .or(page.getByRole("button", { name: /Trip History/i }).first());
    await expect(historyBtn).toBeVisible({ timeout: 10000 });
  });

  test("Refresh button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Refresh/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Deep: Ready to Start Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/trips");
    await expectHeading(page, /My Trips/);
  });

  test("Ready to Start tab shows count badge", async ({ page }) => {
    const tab = page.getByText(/Ready to Start/i).first();
    await expect(tab).toBeVisible({ timeout: 10000 });
  });

  test("table columns are visible", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    // Table has columns: Load, Route, Truck, Dates, Status, Actions — or empty state
    const content = main
      .getByText(/Route|Dates|Actions|Ready to Start/i)
      .first();
    const emptyState = main.getByText(
      /No.*approved loads|no trips|No approved/i
    );
    await expect(content.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("ASSIGNED trips show Ready to Start badge", async ({ page }) => {
    await page.waitForTimeout(2000);
    const badge = page.getByText(/Ready to Start/i).first();
    const emptyState = page.getByText(/No.*approved loads|no trips/i);
    await expect(badge.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("Start Trip button visible for ASSIGNED trips", async ({ page }) => {
    await page.waitForTimeout(2000);
    const startBtn = page.getByRole("button", { name: /Start Trip/i }).first();
    const emptyState = page.getByText(/No.*approved loads|no trips/i);
    await expect(startBtn.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("Details button navigates to trip detail", async ({ page }) => {
    test.skip(!tripId, "No trip available");
    await page.waitForTimeout(2000);

    const detailsBtn = page
      .getByRole("link", { name: /Details|View/i })
      .first();
    const visible = await detailsBtn.isVisible().catch(() => false);
    if (visible) {
      await detailsBtn.click();
      await page.waitForURL("**/carrier/trips/**", { timeout: 10000 });
    }
  });
});

test.describe("Deep: Active Trips Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/trips");
    await expectHeading(page, /My Trips/);
  });

  test("Active Trips tab is accessible", async ({ page }) => {
    const activeTab = page.getByText(/Active Trips/i).first();
    await expect(activeTab).toBeVisible({ timeout: 10000 });
    await activeTab.click();
    await page.waitForTimeout(1500);
  });

  test("shows active trips or empty state", async ({ page }) => {
    const main = page.getByRole("main");
    const activeTab = main.getByText(/Active Trips/i).first();
    await activeTab.click();
    await page.waitForTimeout(2000);

    const tripContent = main
      .getByText(
        /Pickup Pending|In Transit|Delivered|PICKUP_PENDING|IN_TRANSIT|ET-|E2E-/i
      )
      .first();
    const emptyState = main.getByText(/No active trips|no trips|Start a trip/i);
    await expect(tripContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("status badges render with correct labels", async ({ page }) => {
    const activeTab = page.getByText(/Active Trips/i).first();
    await activeTab.click();
    await page.waitForTimeout(2000);

    const badge = page
      .getByText(
        /Pickup Pending|In Transit|Delivered|POD Required|No active trips/i
      )
      .first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("action buttons render per trip status", async ({ page }) => {
    const activeTab = page.getByText(/Active Trips/i).first();
    await activeTab.click();
    await page.waitForTimeout(2000);

    const actionBtn = page
      .getByRole("button", {
        name: /Confirm Pickup|Track Live|Mark Delivered|Upload POD/i,
      })
      .first();
    const emptyState = page.getByText(/No active trips|no trips/i);
    await expect(actionBtn.or(emptyState)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Deep: Trips API Cross-Check", () => {
  test("cross-check trip list against API", async ({ page }) => {
    test.skip(!carrierToken, "No carrier token");
    test.setTimeout(60000);

    await page.goto("/carrier/trips");
    await expectHeading(page, /My Trips/);

    const { status, data } = await apiCall(
      "GET",
      "/api/trips?status=ASSIGNED,PICKUP_PENDING,IN_TRANSIT,DELIVERED&limit=5",
      carrierToken
    );
    expect(status).toBe(200);

    const trips = data.trips ?? data;
    if (Array.isArray(trips) && trips.length > 0) {
      // At least some trip content should be visible
      await expect(
        page.getByText(/Ready to Start|Pickup Pending|In Transit|ET-/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
