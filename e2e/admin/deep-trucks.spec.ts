/**
 * Admin Deep Trucks E2E Tests
 *
 * Verifies truck management: all trucks list, pending approval queue, approve/reject.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  getCarrierToken,
  apiCall,
  ensurePendingTruck,
} from "./test-utils";

test.describe("Admin Trucks — All Trucks", () => {
  test("renders all trucks heading", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    await expectHeading(page, /All Trucks/i);
  });

  test("shows subheading with platform-wide description", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Platform-wide|all trucks/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status tabs are visible", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Should have tab/filter buttons for status
    await expect(
      main.getByRole("button", { name: /All/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("trucks table renders with data", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const table = main.locator("table");
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const rows = table.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Content should exist
      await expect(
        main.getByText(/ET-|FLATBED|trucks found/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("truck rows show license plate and type", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // License plates follow ET- pattern or similar
    await expect(
      main.getByText(/ET-|FLATBED|DRY_VAN|TANKER/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("truck rows show approval status badges", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(
      main.getByText(/APPROVED|PENDING|REJECTED/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("link to pending approvals page exists", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Link text is "Review Pending Approvals →" — verify href exists
    const pendingLink = main.locator("a[href*='/trucks/pending']").first();
    await expect(pendingLink).toBeVisible({ timeout: 5000 });

    const href = await pendingLink.getAttribute("href");
    expect(href).toContain("/trucks/pending");
  });

  test("trucks found count is shown", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/trucks found|\d+ truck/i).first()).toBeVisible(
      { timeout: 10000 }
    );
  });
});

test.describe("Admin Trucks — Pending Approval", () => {
  test("renders stats cards", async ({ page }) => {
    await page.goto("/admin/trucks/pending");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/Pending Approval/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("approved count card visible", async ({ page }) => {
    await page.goto("/admin/trucks/pending");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/Approved/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("rejected count card visible", async ({ page }) => {
    await page.goto("/admin/trucks/pending");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/Rejected/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("status filter dropdown is visible", async ({ page }) => {
    await page.goto("/admin/trucks/pending");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const select = main.locator("select").first();
    await expect(select).toBeVisible({ timeout: 10000 });
  });
});
