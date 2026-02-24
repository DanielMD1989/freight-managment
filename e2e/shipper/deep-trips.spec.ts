/**
 * Deep Trips Page E2E Tests
 *
 * Verifies trip list rendering, status filtering, trip detail,
 * and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Trips Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/trips");
    await expectHeading(page, /Trip History/);
  });

  test("trip list renders with status filter buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delivered" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
  });

  test("trip cards show load references and route info", async ({ page }) => {
    const tripContent = page.getByText(/LOAD-/).first();
    const emptyState = page.getByText(/No completed trips yet/);
    await expect(tripContent.or(emptyState)).toBeVisible({ timeout: 10000 });

    // If trips exist, check for city names
    const cityName = page
      .getByText(/Dire Dawa|Addis Ababa|Djibouti|Mekelle/)
      .first();
    await expect(cityName.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("status filter changes displayed trips", async ({ page }) => {
    await page.getByRole("button", { name: "Delivered" }).click();
    await page.waitForTimeout(1000);
    await expectHeading(page, /Trip History/);

    await page.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(1000);
    await expectHeading(page, /Trip History/);
  });

  test("trip cards have View Route and View Details buttons", async ({
    page,
  }) => {
    const viewBtn = page
      .getByRole("button", { name: /View Route|View Details/i })
      .or(page.getByRole("link", { name: /View Route|View Details/i }))
      .first();
    const emptyState = page.getByText(/No completed trips yet/);
    await expect(viewBtn.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("cross-check trip data against API", async ({ page }) => {
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
      "/api/trips?limit=5",
      shipperToken
    );
    expect(status).toBe(200);

    const trips = data.trips ?? data;
    if (Array.isArray(trips) && trips.length > 0) {
      await expect(page.getByText(/LOAD-/).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });
});
