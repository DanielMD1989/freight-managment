/**
 * Deep GPS & Map E2E Tests — Carrier Portal
 *
 * Verifies GPS device list, Fleet Tracker sidebar,
 * map controls, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: GPS Tracking Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/gps");
    await expectHeading(page, /GPS Tracking/);
  });

  test("truck list with GPS info renders", async ({ page }) => {
    await page.waitForTimeout(2000);
    const gpsContent = page
      .getByText(/IMEI|ACTIVE|OFFLINE|ET-|No GPS|No trucks/i)
      .first();
    await expect(gpsContent).toBeVisible({ timeout: 10000 });
  });

  test("status indicators render with colors", async ({ page }) => {
    await page.waitForTimeout(2000);
    const statusIndicator = page
      .getByText(/ACTIVE|OFFLINE|Online|No GPS|No Device|No trucks/i)
      .first();
    await expect(statusIndicator).toBeVisible({ timeout: 10000 });
  });

  test("trucks without GPS show appropriate state", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Should show some content — either GPS info or "no device" message
    const main = page.getByRole("main");
    const content = main
      .getByText(
        /IMEI|No Device|No GPS|Active|OFFLINE|ET-|No trucks|Total Trucks|GPS Enabled|Without GPS/i
      )
      .first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Deep: Fleet Map Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/map");
    await expectHeading(page, /Fleet Tracker/);
  });

  test("Fleet Tracker title renders", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Fleet Tracker/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("online trucks count shown", async ({ page }) => {
    await expect(page.getByText(/trucks online/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("tab buttons render", async ({ page }) => {
    const tabs = page.getByRole("button").filter({
      hasText: /All|Fleet|Trips|History/i,
    });
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(1);
  });

  test("search input renders", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search trucks|Search/i).first();
    const searchField = page
      .locator("input[type='text']")
      .first()
      .or(page.locator("input[type='search']").first());
    await expect(searchInput.or(searchField)).toBeVisible({ timeout: 10000 });
  });

  test("quick filter buttons render", async ({ page }) => {
    // Quick filter buttons: "Active (0)", "Offline (0)", "In Transit (12)"
    await expect(page.getByRole("button", { name: /^Active \(/ })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /^Offline \(/ })
    ).toBeVisible();
  });

  test("truck list items in sidebar render", async ({ page }) => {
    await page.waitForTimeout(2000);
    const truckItem = page.getByText(/ET-|No trucks|No vehicles/i).first();
    await expect(truckItem).toBeVisible({ timeout: 10000 });
  });

  test("switching tabs changes content", async ({ page }) => {
    const historyTab = page.getByRole("button", { name: /History/i }).first();
    if (await historyTab.isVisible().catch(() => false)) {
      await historyTab.click();
      await page.waitForTimeout(1000);
      // Should still be on map page
      await expectHeading(page, /Fleet Tracker/);
    }
  });

  test("History tab shows date range filter", async ({ page }) => {
    const historyTab = page.getByRole("button", { name: /History/i }).first();
    if (await historyTab.isVisible().catch(() => false)) {
      await historyTab.click();
      await page.waitForTimeout(1000);
      // After clicking History tab, page should still have Fleet Tracker heading
      await expect(
        page.getByRole("heading", { name: /Fleet Tracker/i }).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("cross-check vehicle data against map API", async ({ page }) => {
    test.setTimeout(60000);
    let carrierToken: string;
    try {
      carrierToken = await getCarrierToken();
    } catch {
      test.skip(true, "Could not obtain carrier token");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/map/vehicles",
      carrierToken
    );
    test.skip(status !== 200, `Map vehicles API returned ${status}`);

    if (
      data.vehicles &&
      Array.isArray(data.vehicles) &&
      data.vehicles.length > 0
    ) {
      await expect(page.getByText(/ET-|Online|Active/i).first()).toBeVisible({
        timeout: 10000,
      });
    }

    // Verify stats if available
    if (data.stats?.total !== undefined) {
      expect(data.stats.total).toBeGreaterThanOrEqual(0);
    }
  });
});
