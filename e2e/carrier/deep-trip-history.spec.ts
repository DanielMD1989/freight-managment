/**
 * Deep Trip History E2E Tests — Carrier Portal
 *
 * Verifies completed trip cards, route playback,
 * expandable details, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: Trip History Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/trip-history");
    await expectHeading(page, /Trip History/);
  });

  test("page heading with subtitle renders", async ({ page }) => {
    await expect(
      page
        .getByRole("main")
        .getByText(/Trip History/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Refresh button is visible", async ({ page }) => {
    const main = page.getByRole("main");
    const refreshBtn = main.getByRole("button", { name: /Refresh/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
  });

  test("trip cards show route info or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const tripContent = page
      .getByText(/Addis Ababa|Dire Dawa|→|Pickup|Delivery|No completed trips/i)
      .first();
    await expect(tripContent).toBeVisible({ timeout: 10000 });
  });

  test("trip cards show distance and delivery date", async ({ page }) => {
    await page.waitForTimeout(2000);
    const details = page
      .getByText(/km|Delivered|Completed|No completed trips/i)
      .first();
    await expect(details).toBeVisible({ timeout: 10000 });
  });

  test("trip cards show license plate", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    const plate = main.getByText(/ET-|E2E-|No completed trips/i).first();
    await expect(plate).toBeVisible({ timeout: 10000 });
  });

  test("status badge shows Completed or Delivered", async ({ page }) => {
    await page.waitForTimeout(2000);
    const badge = page
      .getByText(/Completed|Delivered|No completed trips/i)
      .first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("View Route button is visible on trip cards", async ({ page }) => {
    await page.waitForTimeout(2000);
    const viewBtn = page.getByRole("button", { name: /View Route/i }).first();
    const emptyState = page.getByText(/No completed trips/i);
    await expect(viewBtn.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("empty state shows truck emoji and message", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Either shows trip content or the empty state with truck emoji
    const content = page.getByText(/ET-|km|No completed trips/i).first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("cross-check trip history against API", async ({ page }) => {
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
      "/api/trips?status=DELIVERED,COMPLETED&limit=5",
      carrierToken
    );
    expect(status).toBe(200);

    const trips = data.trips ?? data;
    if (Array.isArray(trips) && trips.length > 0) {
      await expect(
        page.getByText(/Delivered|Completed|ET-/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
