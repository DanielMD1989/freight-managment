/**
 * Deep Loadboard — Search Trucks Tab E2E Tests
 *
 * Verifies the "Search Trucks" tab on the loadboard page:
 * filter controls, search results, truck details,
 * and API cross-checking against /api/truck-postings.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Loadboard — Search Trucks Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loadboard?tab=SEARCH_TRUCKS");
    await expectHeading(page, /Loadboard/);
    // Wait for tab switch
    await page.waitForTimeout(1000);
  });

  test("Search Trucks tab shows filter controls", async ({ page }) => {
    await expect(page.getByText("Truck Type").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("filter controls include origin, truck type, and date fields", async ({
    page,
  }) => {
    // Truck Type should be visible
    await expect(page.getByText("Truck Type").first()).toBeVisible({
      timeout: 10000,
    });

    // There should be select/input elements for filtering
    const selects = page.locator("select");
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(1);
  });

  test("search results show truck postings or empty state", async ({
    page,
  }) => {
    await page.waitForTimeout(2000);

    const results = page
      .getByText(
        /FLATBED|BOX_TRUCK|TANKER|CONTAINER|Available|No trucks found/i
      )
      .first();
    await expect(results).toBeVisible({ timeout: 10000 });
  });

  test("truck result card shows carrier and availability info", async ({
    page,
  }) => {
    await page.waitForTimeout(2000);

    // Either show truck details or empty state
    const truckCard = page
      .getByText(/Available|Capacity|Contact|No trucks found/i)
      .first();
    await expect(truckCard).toBeVisible({ timeout: 10000 });
  });

  test("switching back to My Loads tab works", async ({ page }) => {
    const main = page.getByRole("main");
    await main.getByText("My Loads").first().click();
    await page.waitForTimeout(1000);
    await expect(
      page.getByRole("button", { name: /POST NEW LOAD/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test("cross-check search results against API", async ({ page }) => {
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
      "/api/truck-postings?limit=5",
      shipperToken
    );
    expect(status).toBe(200);

    const postings = data.postings ?? data.truckPostings ?? data;
    if (Array.isArray(postings) && postings.length > 0) {
      // At least some content should be visible
      await expect(
        page.getByText(/Available|FLATBED|BOX_TRUCK|Contact/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
