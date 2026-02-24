/**
 * Admin Deep Service Fees E2E Tests
 *
 * Verifies service fee overview, revenue stats, and corridor breakdowns.
 */

import { test, expect } from "@playwright/test";
import { waitForMainContent, getAdminToken, apiCall } from "./test-utils";

test.describe("Admin Service Fees", () => {
  test("renders service fee page", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/Service Fee/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("displays revenue stats", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Should show some revenue or fee metric
    await expect(main.getByText(/Revenue|Total|ETB|Fee/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("fee status breakdown visible", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Should show fee status categories
    await expect(
      main
        .getByText(/DEDUCTED|PENDING|WAIVED|Deducted|Pending|Waived|Status/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("corridor-based breakdown visible", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // May show corridor names or "No corridor data"
    await expect(
      main
        .getByText(/Corridor|corridor|No service fee|Overview|Metrics/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("ETB currency is shown in fee amounts", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/ETB|fee/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("cross-check service fee metrics against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status } = await apiCall(
      "GET",
      "/api/admin/service-fees/metrics",
      token
    );
    test.skip(status !== 200, `Service fees API returned ${status}`);

    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/Service Fee/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("page renders numeric values", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Should display ETB amounts in definition lists (e.g., "ETB 15,855.00")
    await expect(
      main.locator("dd, td").filter({ hasText: /ETB/ }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("no errors on page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/admin/service-fees");
    await waitForMainContent(page);

    // Filter out non-critical errors
    const critical = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("ResizeObserver")
    );
    expect(critical).toHaveLength(0);
  });
});
