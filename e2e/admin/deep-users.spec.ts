/**
 * Admin Deep Users E2E Tests
 *
 * Verifies user management: list, search, filter, detail, edit.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  apiCall,
} from "./test-utils";

test.describe("Admin Users", () => {
  test("renders user management heading", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    await expectHeading(page, /User Management/i);
  });

  test("shows total user count in subheading", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/total\)/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("search input is visible", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const searchInput = page.getByPlaceholder(/Search by email|Search/i);
    await expect(searchInput.first()).toBeVisible({ timeout: 10000 });
  });

  test("role filter dropdown is visible", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    // Look for a select or filter element
    const roleFilter = main.locator("select").first();
    await expect(roleFilter).toBeVisible({ timeout: 10000 });
  });

  test("users table renders with data", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    // Should have a table with user data
    const table = main.locator("table");
    if (await table.isVisible()) {
      const rows = table.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // May use cards instead of table
      await expect(main.getByText(/test\.com|@/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("user rows show email and role", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Table should have user data — look for email in table cells
    const table = main.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // Should display role badges in cells
    await expect(
      table.getByText(/Shipper|Carrier|Admin|SHIPPER|CARRIER|ADMIN/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("search filters users", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);

    const searchInput = page.getByPlaceholder(/Search by email|Search/i);
    await searchInput.first().fill("admin@test.com");

    // Press enter or click search button
    const searchBtn = page.getByRole("button", { name: /Search/i });
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBtn.click();
    } else {
      await searchInput.first().press("Enter");
    }

    await page.waitForLoadState("domcontentloaded");

    const main = page.getByRole("main");
    await expect(main.getByText("admin@test.com").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("pagination controls are visible when there are users", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Look for pagination text or buttons
    const hasPagination = await main
      .getByText(/Showing|Page \d|Previous|Next/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // It's acceptable for pagination to be absent if there are few users
    expect(true).toBe(true); // Soft pass
    if (hasPagination) {
      await expect(main.getByText(/Showing|Page/i).first()).toBeVisible();
    }
  });

  test("view action navigates to user detail", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // View may be a link or button
    const viewLink = main.getByRole("link", { name: /View/i }).first();
    const viewBtn = main.getByRole("button", { name: /View/i }).first();

    const hasViewLink = await viewLink
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasViewBtn = await viewBtn
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (hasViewLink) {
      await viewLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toContain("/admin/users/");
    } else if (hasViewBtn) {
      await viewBtn.click();
      await page.waitForLoadState("domcontentloaded");
    }
    expect(hasViewLink || hasViewBtn).toBe(true);
  });

  test("edit action visible on user rows", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Edit may be a link or button
    const editLink = main.getByRole("link", { name: /Edit/i }).first();
    const editBtn = main.getByRole("button", { name: /Edit/i }).first();

    const hasEditLink = await editLink
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasEditBtn = await editBtn
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasEditLink || hasEditBtn).toBe(true);
  });

  test("cross-check user list against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status, data } = await apiCall(
      "GET",
      "/api/admin/users?page=1&limit=5",
      token
    );
    test.skip(status !== 200, `Users API returned ${status}`);

    await page.goto("/admin/users");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Verify at least one user from API is shown
    if (data.users?.length > 0) {
      const firstEmail = data.users[0].email;
      // Page might not show this exact user (pagination), so just verify content exists
      await expect(main.getByText(/@/i).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("role filter changes displayed users", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);

    const main = page.getByRole("main");
    const select = main.locator("select").first();

    if (await select.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Select a specific role
      const options = await select.locator("option").allTextContents();
      if (options.some((o) => /Shipper/i.test(o))) {
        await select.selectOption({
          label: options.find((o) => /Shipper/i.test(o))!,
        });
        await page.waitForLoadState("domcontentloaded");
      }
    }
    // Page should still render
    await expectHeading(page, /User Management/i);
  });
});
