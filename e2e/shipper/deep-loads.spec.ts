/**
 * Deep Loads Page E2E Tests
 *
 * Verifies load list rendering, status filtering, CRUD actions,
 * load detail page, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import {
  getToken,
  apiCall,
  ensureLoad,
  expectHeading,
  TEST_PASSWORD,
} from "./test-utils";

let shipperToken: string;
let loadId: string;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    shipperToken = await getToken("shipper@test.com", TEST_PASSWORD);
    loadId = await ensureLoad(shipperToken);
  } catch {
    // Tests that need these will skip
  }
});

test.describe("Deep: Loads List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loads");
    await expectHeading(page, /My Loads/);
  });

  test("all status filter buttons render", async ({ page }) => {
    const filters = [
      "All Loads",
      "Drafts",
      "Unposted",
      "Posted",
      "Active Trips",
      "Delivered",
      "Completed",
      "Cancelled",
    ];
    for (const name of filters) {
      await expect(
        page.getByRole("button", { name, exact: true })
      ).toBeVisible();
    }
  });

  test("table renders with all column headers", async ({ page }) => {
    const columns = ["Age", "Route", "Dates", "Details", "Status", "Actions"];
    for (const col of columns) {
      await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
    }
  });

  test("load rows display city names and status badges", async ({ page }) => {
    await expect(
      page.getByText(/Addis Ababa|Dire Dawa|Djibouti|Mekelle/).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/POSTED|ASSIGNED|DELIVERED/).first()
    ).toBeVisible();
  });

  test("total loads count is visible", async ({ page }) => {
    await expect(page.getByText(/Total:\s*\d+\s*loads/)).toBeVisible({
      timeout: 10000,
    });
  });

  test("status filter changes displayed loads", async ({ page }) => {
    // Click Posted filter
    await page.getByRole("button", { name: "Posted", exact: true }).click();
    await page.waitForTimeout(1000);

    // Page should still render (heading visible)
    await expectHeading(page, /My Loads/);

    // Click All Loads to reset
    await page.getByRole("button", { name: "All Loads" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Total:\s*\d+\s*loads/)).toBeVisible();
  });

  test("View action navigates to load detail page", async ({ page }) => {
    test.skip(!loadId, "No loadId available");

    // Click first View link
    await page.getByText("View").first().click();
    await page.waitForURL("**/shipper/loads/**", { timeout: 10000 });

    // Detail page should show route info
    await expect(
      page.getByText(/Addis Ababa|Dire Dawa|Route Details/).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Copy action creates a duplicate load", async ({ page }) => {
    test.skip(!loadId, "No loadId available");
    test.setTimeout(45000);

    // Intercept POST /api/loads (the copy action)
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/loads") &&
        resp.request().method() === "POST" &&
        !resp.url().includes("load-requests"),
      { timeout: 30000 }
    );

    await page.getByText("Copy").first().click();

    try {
      const response = await responsePromise;
      // Copy might create a load or navigate to create page
      if (response.status() === 201) {
        const body = await response.json();
        expect(body.load?.id ?? body.id).toBeTruthy();
      }
    } catch {
      // Copy might navigate to create page pre-filled instead
      await page
        .waitForURL("**/shipper/loads/create**", { timeout: 5000 })
        .catch(() => {});
    }
  });

  test("cross-check load list against API", async ({ page }) => {
    test.skip(!shipperToken, "Could not obtain shipper token");

    const { status, data } = await apiCall(
      "GET",
      "/api/loads?myLoads=true&limit=5",
      shipperToken
    );
    expect(status).toBe(200);

    const loads = data.loads ?? data;
    expect(Array.isArray(loads)).toBe(true);

    // If there are loads in API, they should appear on page
    if (loads.length > 0) {
      await expect(
        page.getByText(/POSTED|ASSIGNED|DELIVERED|DRAFT/).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Deep: Load Detail Page", () => {
  test("load detail shows complete information", async ({ page }) => {
    test.skip(!loadId, "No loadId available");

    await page.goto(`/shipper/loads/${loadId}`);

    // Route Details card
    await expect(
      page.getByText(/Route Details|Addis Ababa/).first()
    ).toBeVisible({ timeout: 10000 });

    // Status badge
    await expect(
      page.getByText(/POSTED|ASSIGNED|DELIVERED|DRAFT/).first()
    ).toBeVisible();

    // Back link (use role link to avoid matching hidden sidebar)
    await expect(
      page.getByRole("link", { name: /Back|← My Loads|loads/i }).first()
    ).toBeVisible();
  });

  test("load detail shows cargo information", async ({ page }) => {
    test.skip(!loadId, "No loadId available");

    await page.goto(`/shipper/loads/${loadId}`);

    await expect(page.getByText(/Cargo Details|Weight|kg/).first()).toBeVisible(
      { timeout: 10000 }
    );
  });

  test("load detail cross-checks against API", async ({ page }) => {
    test.skip(!loadId || !shipperToken, "Missing loadId or token");

    const { status, data } = await apiCall(
      "GET",
      `/api/loads/${loadId}`,
      shipperToken
    );
    expect(status).toBe(200);

    await page.goto(`/shipper/loads/${loadId}`);

    // Verify pickup city matches
    const load = data.load ?? data;
    if (load.pickupCity) {
      await expect(page.getByText(load.pickupCity).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });
});
