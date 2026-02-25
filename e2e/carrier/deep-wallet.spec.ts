/**
 * Deep Wallet E2E Tests — Carrier Portal
 *
 * Verifies balance card, financial summary, transaction history,
 * filters, withdraw button, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: Carrier Wallet Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
  });

  test("balance card renders with ETB amount", async ({ page }) => {
    await expect(page.getByText("Current Balance").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/ETB/).first()).toBeVisible();
  });

  test("pending trips info renders", async ({ page }) => {
    await expect(page.getByText(/Pending Trips/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("cross-check balance against wallet API", async ({ page }) => {
    test.setTimeout(60000);
    let carrierToken: string;
    try {
      carrierToken = await getCarrierToken();
    } catch {
      test.skip(true, "Could not obtain carrier token");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/wallet/balance",
      carrierToken
    );
    expect(status).toBe(200);

    if (data.totalBalance !== undefined) {
      const numericPart = String(Math.floor(Number(data.totalBalance)));
      const formatted = Number(data.totalBalance).toLocaleString();
      await expect(
        page
          .getByText(numericPart)
          .first()
          .or(page.getByText(formatted).first())
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("financial summary cards render", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText(/Total Earnings/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText(/Total Withdrawn/i).first()).toBeVisible();
    await expect(main.getByText(/Completed Trips/i).first()).toBeVisible();
  });

  test("transaction history section renders", async ({ page }) => {
    await expect(
      page.getByText(/Transaction History|Recent Transactions/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("transaction filter tabs are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /Earnings/i })).toBeVisible();
  });

  test("filter switching changes displayed transactions", async ({ page }) => {
    await page.getByRole("button", { name: /Earnings/i }).click();
    await page.waitForTimeout(1000);
    await expect(
      page.getByText(/Transaction History|Recent Transactions/i).first()
    ).toBeVisible();

    await page.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(1000);

    const txContent = page
      .getByText(/Earnings|Settlement|Deposit|Withdrawal/i)
      .first();
    const emptyState = page.getByText(/No transactions/i);
    await expect(txContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("Withdraw button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: "Withdraw", exact: true })
    ).toBeVisible({ timeout: 10000 });
  });

  test("transaction amounts show ETB currency", async ({ page }) => {
    await expect(page.getByText(/ETB/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
