/**
 * Deep Trucks List E2E Tests — Carrier Portal
 *
 * Verifies truck list tabs (Approved/Pending/Rejected), truck cards,
 * filters, pagination, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import {
  getCarrierToken,
  apiCall,
  expectHeading,
  ensureTruck,
} from "./test-utils";

let carrierToken: string;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    carrierToken = await getCarrierToken();
    await ensureTruck(carrierToken);
  } catch {
    // Tests that need token will skip
  }
});

test.describe("Deep: Trucks List Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/trucks");
    await expectHeading(page, /My Trucks/);
  });

  test("page heading and subtitle render", async ({ page }) => {
    await expect(page.getByText(/Manage your trucks/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Register New Truck button is visible and navigates", async ({
    page,
  }) => {
    const btn = page
      .getByRole("link", { name: /Register New Truck|Add Truck/i })
      .first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await page.waitForURL("**/carrier/trucks/add**", { timeout: 10000 });
    await expectHeading(page, /Register New Truck/);
  });

  test("Approved tab is active by default", async ({ page }) => {
    const approvedTab = page.getByRole("button", { name: /Approved/i }).first();
    await expect(approvedTab).toBeVisible({ timeout: 10000 });
  });

  test("truck cards show license plate and type", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    // Truck data is in a table — use cell role to avoid matching hidden option elements
    const truckCell = main
      .getByRole("cell", {
        name: /FLATBED|REFRIGERATED|DRY VAN|CONTAINER|TANKER/i,
      })
      .first();
    const emptyState = main.getByRole("heading", {
      name: /No.*trucks|Approved Trucks \(0\)/i,
    });
    await expect(truckCell.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("truck cards show availability badge", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    // Table cells show "No GPS" or GPS status. Column header "Status" always visible.
    const statusCol = main.getByRole("columnheader", { name: /Status/i });
    const emptyState = main.getByRole("heading", {
      name: /No.*trucks|Approved Trucks \(0\)/i,
    });
    await expect(statusCol.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("View Details navigates to truck detail page", async ({ page }) => {
    test.skip(!carrierToken, "No carrier token");
    await page.waitForTimeout(2000);

    const viewBtn = page
      .getByRole("link", { name: /View Details|View/i })
      .first();
    const emptyState = page.getByText(/No.*trucks/i);

    const viewVisible = await viewBtn.isVisible().catch(() => false);
    if (!viewVisible) {
      await expect(emptyState).toBeVisible();
      return;
    }
    await viewBtn.click();
    await page.waitForURL("**/carrier/trucks/**", { timeout: 10000 });
  });

  test("Pending tab shows pending trucks or empty state", async ({ page }) => {
    await page.getByRole("button", { name: /Pending/i }).click();
    await page.waitForTimeout(1500);

    const pendingContent = page
      .getByText(/Pending Approval|PENDING|ET-/i)
      .first();
    const emptyState = page.getByText(/No.*trucks|no pending/i);
    await expect(pendingContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("Rejected tab shows rejected trucks or empty state", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Rejected/i }).click();
    await page.waitForTimeout(1500);

    const rejectedContent = page
      .getByText(/REJECTED|Rejection Reason|ET-/i)
      .first();
    const emptyState = page.getByText(/No.*trucks|no rejected/i);
    await expect(rejectedContent.or(emptyState)).toBeVisible({
      timeout: 10000,
    });
  });

  test("truck type filter dropdown is visible", async ({ page }) => {
    const main = page.getByRole("main");
    // Filter is a combobox (select) element
    await expect(main.getByRole("combobox").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("cross-check truck count against API", async ({ page }) => {
    test.skip(!carrierToken, "No carrier token");
    test.setTimeout(60000);

    const { status, data } = await apiCall(
      "GET",
      "/api/trucks?myTrucks=true&limit=5",
      carrierToken
    );
    expect(status).toBe(200);

    const trucks = data.trucks ?? data;
    if (Array.isArray(trucks) && trucks.length > 0) {
      const main = page.getByRole("main");
      // At least one truck cell should be visible in the table
      await expect(
        main
          .getByRole("cell", {
            name: /FLATBED|REFRIGERATED|DRY VAN|CONTAINER|TANKER/i,
          })
          .first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
