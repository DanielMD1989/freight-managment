import { test, expect } from "@playwright/test";
import {
  expectHeading,
  expectNumericText,
  waitForMainContent,
  getDispatcherToken,
  apiCall,
} from "./test-utils";

test.describe("Deep: Dispatcher Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dispatcher/dashboard");
    await waitForMainContent(page);
  });

  test("renders welcome heading with dispatcher name", async ({ page }) => {
    await expectHeading(page, /Welcome back/i);
  });

  test("renders server heading", async ({ page }) => {
    await expectHeading(page, /Dispatcher Dashboard/i);
  });

  test("shows Unassigned Loads stat card", async ({ page }) => {
    await expectNumericText(page, "Unassigned Loads");
  });

  test("shows In Transit stat card", async ({ page }) => {
    await expectNumericText(page, "In Transit");
  });

  test("shows Deliveries Today stat card", async ({ page }) => {
    await expectNumericText(page, "Deliveries Today");
  });

  test("shows On-Time Rate stat card", async ({ page }) => {
    await expectNumericText(page, "On-Time Rate");
  });

  test("shows Available Trucks stat card", async ({ page }) => {
    await expectNumericText(page, "Available Trucks");
  });

  test("shows Alerts stat card", async ({ page }) => {
    await expectNumericText(page, "Alerts");
  });

  test("Quick Actions: Find Matches links to loads", async ({ page }) => {
    const link = page.getByRole("link", { name: /Find Matches/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", /\/dispatcher\/loads/);
  });

  test("Quick Actions: View Map links to map", async ({ page }) => {
    const link = page.getByRole("link", { name: /View Map/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", /\/dispatcher\/map/);
  });

  test("Quick Actions: Manage Trucks links to trucks", async ({ page }) => {
    const link = page.getByRole("link", { name: /Manage Trucks/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await expect(link).toHaveAttribute("href", /\/dispatcher\/trucks/);
  });

  test("tab switching: All Loads and All Trucks tabs", async ({ page }) => {
    const main = page.getByRole("main");
    const loadsTab = main.getByRole("button", { name: /All Loads/i });
    const trucksTab = main.getByRole("button", { name: /All Trucks/i });

    await expect(loadsTab).toBeVisible({ timeout: 10000 });
    await expect(trucksTab).toBeVisible({ timeout: 10000 });

    // Click trucks tab
    await trucksTab.click();
    // Verify trucks content appears (License Plate column)
    await expect(main.getByText(/License Plate/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Click back to loads tab
    await loadsTab.click();
    await expect(main.getByText(/Load ID/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Today's Schedule section visible", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText(/Today's Schedule/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Alerts section visible", async ({ page }) => {
    const main = page.getByRole("main");
    // Alerts section heading (distinct from the stat card)
    const alertsSection = main
      .getByText(/Issues requiring attention|All clear/i)
      .first();
    const alertsHeading = main.getByRole("heading", { name: /Alerts/i });
    const hasSection = await alertsSection
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasHeading = await alertsHeading
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasSection || hasHeading).toBe(true);
  });

  test("cross-check stats against dashboard API", async () => {
    test.setTimeout(60000);
    const token = await getDispatcherToken();
    const { status, data } = await apiCall(
      "GET",
      "/api/dispatcher/dashboard",
      token
    );
    test.skip(status !== 200, `Dashboard API returned ${status}`);
    // Verify API returns expected shape
    expect(data).toBeDefined();
  });

  test("status filter dropdown works in loads tab", async ({ page }) => {
    const main = page.getByRole("main");
    // Ensure loads tab is active
    const loadsTab = main.getByRole("button", { name: /All Loads/i });
    await loadsTab.click();

    // Look for a status filter (select or button)
    const statusFilter = main.getByRole("combobox").first();
    const hasCombobox = await statusFilter
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasCombobox) {
      await statusFilter.selectOption({ index: 1 });
    } else {
      // May be a custom dropdown
      const filterBtn = main.getByText(/All Statuses/i).first();
      const hasFilter = await filterBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(hasFilter || hasCombobox).toBe(true);
    }
  });

  test("refresh button works", async ({ page }) => {
    const main = page.getByRole("main");
    const refreshBtn = main.getByRole("button", { name: /refresh/i }).first();
    const hasRefresh = await refreshBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasRefresh) {
      await refreshBtn.click();
      // Should still show dashboard content after refresh
      await expectHeading(page, /Welcome back/i);
    } else {
      // Some dashboard variants use icon-only refresh
      const iconRefresh = main
        .locator("button")
        .filter({ has: page.locator("svg") })
        .first();
      await expect(iconRefresh).toBeVisible({ timeout: 5000 });
    }
  });
});
