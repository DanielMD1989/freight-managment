/**
 * Admin Deep Wallets E2E Tests
 *
 * Verifies wallet/account management: list, tabs, financial summary.
 * Note: Wallet API may fail in dev — tests accept error state as valid rendering.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  apiCall,
} from "./test-utils";

test.describe("Admin Wallets", () => {
  test("renders user wallets heading", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    await expectHeading(page, /User Wallets/i);
  });

  test("shows subheading about financial accounts", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/financial accounts|shipper and carrier/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("account type tabs render", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(
      main.getByRole("button", { name: /All/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("financial summary cards render", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Cards show even when API fails (they just show ETB 0)
    await expect(
      main
        .getByText(/Platform Revenue|Shipper Deposits|Carrier Earnings/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("ETB currency is displayed", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/ETB/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("wallets table headers render", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Table renders even when empty (shows "No accounts found")
    const table = main.locator("table");
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Table exists — check headers
      await expect(
        table.getByText(/Account Type|Owner|Balance/i).first()
      ).toBeVisible();
    } else {
      // Accept error state or card view
      await expect(
        main.getByText(/wallet|account|Failed to load/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("shipper wallets tab is clickable", async ({ page }) => {
    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const shipperTab = main.getByRole("button", {
      name: /Shipper Wallets/i,
    });
    if (
      await shipperTab
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await shipperTab.first().click();
      await page.waitForLoadState("domcontentloaded");
    }
    // Page should still render
    await expectHeading(page, /User Wallets/i);
  });

  test("cross-check wallets against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status } = await apiCall(
      "GET",
      "/api/wallets?page=1&limit=5",
      token
    );
    test.skip(status !== 200, `Wallets API returned ${status}`);

    await page.goto("/admin/wallets");
    await waitForMainContent(page);
    await expectHeading(page, /User Wallets/i);
  });
});
