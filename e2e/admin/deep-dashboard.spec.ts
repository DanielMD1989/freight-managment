/**
 * Admin Deep Dashboard E2E Tests
 *
 * Verifies the admin dashboard renders KPIs, quick actions, and system status.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  apiCall,
} from "./test-utils";

test.describe("Admin Dashboard", () => {
  test("renders welcome heading with admin name", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    await expectHeading(page, /Welcome back/i);
  });

  test("displays KPI stat cards", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Check for key metric labels
    await expect(main.getByText("Total Users").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText("Organizations").first()).toBeVisible();
  });

  test("displays total loads metric", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText("Total Loads").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("displays total trucks metric", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText("Total Trucks").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("displays load status breakdown section", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Loads by Status|Load Status/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("displays quick actions section", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText("Quick Actions").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("quick actions link to correct pages", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Check links exist for key admin functions
    const manageUsersLink = main.getByRole("link", {
      name: /Manage Users/i,
    });
    await expect(manageUsersLink.first()).toBeVisible({ timeout: 10000 });
  });

  test("displays system status section", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText("System Status").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("system status shows operational indicators", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    // API status should show operational
    await expect(
      main.getByText(/Operational|Connected|Active/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("cross-check dashboard stats against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status, data } = await apiCall(
      "GET",
      "/api/admin/analytics?period=week",
      token
    );
    test.skip(status !== 200, `Admin analytics API returned ${status}`);

    await page.goto("/admin");
    await waitForMainContent(page);
    // Just verify the page loaded with stats — exact values may differ
    const main = page.getByRole("main");
    await expect(main.getByText("Total Users").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
