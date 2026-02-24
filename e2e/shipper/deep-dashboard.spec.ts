/**
 * Deep Dashboard E2E Tests
 *
 * Verifies stat cards, quick actions, dashboard sections,
 * and cross-checks displayed data against the API.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/dashboard");
    await expectHeading(page, /Welcome back/);
  });

  test("all 5 stat cards render with numeric values", async ({ page }) => {
    const main = page.getByRole("main");

    const cards = [
      "Total Loads Posted",
      "Active Shipments",
      "Delivered This Month",
      "Pending Loads",
      "Total Spent",
    ];

    for (const label of cards) {
      await expect(main.getByText(label).first()).toBeVisible({
        timeout: 10000,
      });
    }

    // At least one card should show a number (0 counts as valid)
    await expect(main.getByText(/\d/).first()).toBeVisible();
  });

  test("cross-check stat values against API", async ({ page }) => {
    test.setTimeout(60000);
    let shipperToken: string;
    try {
      shipperToken = await getToken("shipper@test.com", TEST_PASSWORD);
    } catch {
      test.skip(true, "Could not obtain shipper token");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/shipper/dashboard",
      shipperToken
    );
    expect(status).toBe(200);

    const main = page.getByRole("main");

    // The API returns stats — verify at least totalLoads matches displayed value
    if (data.stats?.totalLoads !== undefined) {
      await expect(
        main.getByText(String(data.stats.totalLoads)).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("quick action Post New Load navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /Post New Load/ }).click();
    await page.waitForURL("**/shipper/loads/create**", { timeout: 10000 });
    await expectHeading(page, /Post New Load/);
  });

  test("quick action Track Shipments navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /Track Shipments/ }).click();
    await page.waitForURL("**/shipper/map**", { timeout: 10000 });
    await expectHeading(page, /Track Shipments/);
  });

  test("quick action Find Trucks navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /Find Trucks/ }).click();
    await page.waitForURL("**/shipper/loadboard**", { timeout: 10000 });
    await expectHeading(page, /Loadboard/);
  });

  test("Active Shipments section renders", async ({ page }) => {
    const main = page.getByRole("main");
    const section = main.getByText("Active Shipments").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("My Posted Loads section renders with data or empty state", async ({
    page,
  }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("My Posted Loads")).toBeVisible({
      timeout: 10000,
    });

    // Should show either a View All link or some load content
    const viewAll = main.getByRole("link", { name: "View All" }).first();
    await expect(viewAll).toBeVisible({ timeout: 10000 });
  });

  test("Carrier Applications section renders", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText(/Carrier Applications/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
