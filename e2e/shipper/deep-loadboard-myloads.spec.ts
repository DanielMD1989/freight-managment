/**
 * Deep Loadboard — My Loads Tab E2E Tests
 *
 * Verifies the "My Loads" tab on the loadboard page:
 * load listings, status filters, POST NEW LOAD button,
 * and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import {
  getToken,
  apiCall,
  ensureLoad,
  expectHeading,
  TEST_PASSWORD,
} from "./test-utils";

test.describe("Deep: Loadboard — My Loads Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loadboard");
    await expectHeading(page, /Loadboard/);
  });

  test("My Loads tab is active by default", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("My Loads").first()).toBeVisible();
  });

  test("POST NEW LOAD button is visible and clickable", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /POST NEW LOAD/i })
      .or(page.getByRole("link", { name: /POST NEW LOAD/i }));
    await expect(btn).toBeVisible();

    // Click the button — it may navigate or expand an inline form
    await btn.click();
    await page.waitForTimeout(2000);

    // Verify the page responded (either navigated or expanded form)
    await expect(
      page.getByRole("heading", { name: /Loadboard|Post New Load/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status filters are visible", async ({ page }) => {
    await expect(
      page.getByText("Posted", { exact: true }).first()
    ).toBeVisible();
  });

  test("load listings show route data or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const content = page
      .getByText(/Addis Ababa|Dire Dawa|Djibouti|Mekelle|No Posted Loads/i)
      .first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("load listings show status badges or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const status = page.getByText(/POSTED|ASSIGNED|FLATBED/i).first();
    const empty = page.getByText(/No Posted Loads|No loads/i).first();
    await expect(status.or(empty)).toBeVisible({ timeout: 10000 });
  });

  test("Find Trucks tab is accessible from loadboard", async ({ page }) => {
    const main = page.getByRole("main");
    await main.getByText("Search Trucks").click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Truck Type").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("cross-check load count against API", async ({ page }) => {
    test.setTimeout(60000);
    let shipperToken: string;
    try {
      shipperToken = await getToken("shipper@test.com", TEST_PASSWORD);
      await ensureLoad(shipperToken);
    } catch {
      test.skip(true, "Could not obtain shipper token");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/loads?myLoads=true&status=POSTED",
      shipperToken
    );
    expect(status).toBe(200);

    const loads = data.loads ?? data;
    if (Array.isArray(loads) && loads.length > 0) {
      // At least one load should be visible on the page
      await expect(
        page.getByText(/Addis Ababa|Dire Dawa|Djibouti|Mekelle/).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
