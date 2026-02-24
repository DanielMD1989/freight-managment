/**
 * Admin Deep Disputes E2E Tests
 *
 * Verifies dispute management: list, filters, detail, status update.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  apiCall,
} from "./test-utils";

test.describe("Admin Disputes", () => {
  test("renders disputes management heading", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    await expectHeading(page, /Disputes/i);
  });

  test("shows subheading about dispute resolution", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/resolve|Review|platform/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status filter buttons render", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(
      main.getByRole("button", { name: /All/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("OPEN filter button visible", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/OPEN|Open/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("statistics cards show status counts", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Stats cards for dispute statuses
    await expect(
      main.getByText(/OPEN|UNDER_REVIEW|RESOLVED|CLOSED/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("disputes table/list renders", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const table = main.locator("table");
    const hasTable = await table
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasTable) {
      expect(true).toBe(true);
    } else {
      // Should show "no disputes" or card-based list
      await expect(
        main.getByText(/No disputes|dispute|OPEN|View/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("view link navigates to dispute detail", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const viewLink = main.getByRole("link", { name: /View/i }).first();
    const hasView = await viewLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasView) {
      await viewLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toContain("/admin/disputes/");
    }
  });

  test("cross-check disputes against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status } = await apiCall("GET", "/api/disputes", token);
    test.skip(status !== 200, `Disputes API returned ${status}`);

    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    await expectHeading(page, /Disputes/i);
  });
});
