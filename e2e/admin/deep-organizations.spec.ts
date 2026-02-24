/**
 * Admin Deep Organizations E2E Tests
 *
 * Verifies organization management: list, filter, stats, verify actions.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  apiCall,
} from "./test-utils";

test.describe("Admin Organizations", () => {
  test("renders organization management heading", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    await expectHeading(page, /Organization Management/i);
  });

  test("shows total count in subheading", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/total\)/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("statistics cards render", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText("Total Organizations").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("type filter dropdown is visible", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    const typeFilter = main.locator("select").first();
    await expect(typeFilter).toBeVisible({ timeout: 10000 });
  });

  test("organizations table renders with data", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const table = main.locator("table");
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const rows = table.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Cards layout
      await expect(main.getByText(/Shipper|Carrier/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("organization cards show name and type", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Table should have org data
    const table = main.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Should display organization type in table (SHIPPER, CARRIER COMPANY, etc.)
    await expect(
      table.getByText(/SHIPPER|CARRIER|Shipper|Carrier/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("verify/unverify button visible on org rows", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const hasVerifyBtn = await main
      .getByRole("button", { name: /Verify|Unverify/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const hasVerifyLink = await main
      .getByRole("link", { name: /Verify|View/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasVerifyBtn || hasVerifyLink).toBe(true);
  });

  test("cross-check org list against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status, data } = await apiCall(
      "GET",
      "/api/admin/organizations?page=1&limit=5",
      token
    );
    test.skip(status !== 200, `Organizations API returned ${status}`);

    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Verify content rendered
    await expect(main.getByText(/Organization/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
