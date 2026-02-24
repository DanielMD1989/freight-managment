/**
 * Admin Deep Navigation E2E Tests
 *
 * Verifies all admin pages are accessible and render expected headings.
 */

import { test, expect } from "@playwright/test";
import { expectHeading, waitForMainContent } from "./test-utils";

test.describe("Admin Navigation", () => {
  test("dashboard loads with welcome heading", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    await expectHeading(page, /Welcome back/i);
  });

  test("analytics page loads", async ({ page }) => {
    await page.goto("/admin/analytics");
    await waitForMainContent(page);
    // Analytics client component renders its own heading
    const main = page.getByRole("main");
    await expect(main.getByText(/analytics/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("user management page loads", async ({ page }) => {
    await page.goto("/admin/users");
    await waitForMainContent(page);
    await expectHeading(page, /User Management/i);
  });

  test("organizations page loads", async ({ page }) => {
    await page.goto("/admin/organizations");
    await waitForMainContent(page);
    await expectHeading(page, /Organization Management/i);
  });

  test("trucks page loads", async ({ page }) => {
    await page.goto("/admin/trucks");
    await waitForMainContent(page);
    await expectHeading(page, /All Trucks/i);
  });

  test("truck approval page loads", async ({ page }) => {
    await page.goto("/admin/trucks/pending");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Pending Approval|Approved|Rejected/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("loads page loads", async ({ page }) => {
    await page.goto("/admin/loads");
    await waitForMainContent(page);
    await expectHeading(page, /All Loads/i);
  });

  test("trips page loads", async ({ page }) => {
    await page.goto("/admin/trips");
    await waitForMainContent(page);
    await expectHeading(page, /All Trips/i);
  });

  test("verification page loads", async ({ page }) => {
    await page.goto("/admin/verification");
    await waitForMainContent(page);
    await expectHeading(page, /Document Verification/i);
  });

  test("wallets page loads", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    await expectHeading(page, /User Wallets/i);
  });

  test("service fees page loads", async ({ page }) => {
    await page.goto("/admin/service-fees");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/Service Fee/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("settlement page loads", async ({ page }) => {
    await page.goto("/admin/settlement");
    await waitForMainContent(page);
    await expectHeading(page, /Settlement/i);
  });

  test("withdrawals page loads", async ({ page }) => {
    await page.goto("/admin/withdrawals");
    await waitForMainContent(page);
    await expectHeading(page, /Withdrawal/i);
  });

  test("disputes page loads", async ({ page }) => {
    await page.goto("/admin/disputes");
    await waitForMainContent(page);
    await expectHeading(page, /Disputes/i);
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/admin/settings");
    await waitForMainContent(page);
    await expectHeading(page, /System Settings/i);
  });

  test("corridors page loads", async ({ page }) => {
    await page.goto("/admin/corridors");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/Corridor/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("GPS page loads", async ({ page }) => {
    await page.goto("/admin/gps");
    await waitForMainContent(page);
    // Page may show heading or error state from API
    const main = page.getByRole("main");
    await expect(
      main.getByText(/GPS|Device Management|Failed to fetch/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("map page loads", async ({ page }) => {
    await page.goto("/admin/map");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(main.getByText(/Map|Fleet/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("security page loads", async ({ page }) => {
    await page.goto("/admin/security");
    await waitForMainContent(page);
    await expectHeading(page, /Security/i);
  });

  test("audit logs page loads", async ({ page }) => {
    await page.goto("/admin/audit-logs");
    await page.waitForLoadState("domcontentloaded");
    // May show audit log heading or Access Denied (requires SUPER_ADMIN)
    await expect(
      page.getByText(/Audit Log|Access Denied/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("health page loads", async ({ page }) => {
    await page.goto("/admin/health");
    await waitForMainContent(page);
    await expectHeading(page, /System Health/i);
  });

  test("sidebar contains navigation links", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    // Sidebar should have multiple nav links
    const navLinks = page.locator("nav a, aside a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(5);
  });

  test("auth persists across page navigation", async ({ page }) => {
    await page.goto("/admin");
    await waitForMainContent(page);
    await page.goto("/admin/users");
    await waitForMainContent(page);
    // Should NOT redirect to login
    expect(page.url()).toContain("/admin/users");
    await expectHeading(page, /User Management/i);
  });

  test("unauthenticated user redirected to login", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/admin");
    // Should redirect to login or unauthorized
    await page.waitForURL(/\/(login|unauthorized)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(login|unauthorized)/);
    await context.close();
  });
});
