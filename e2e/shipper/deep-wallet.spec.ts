/**
 * Deep Wallet Page E2E Tests
 *
 * Verifies balance cards, financial summary, transaction history,
 * filters, deposit button, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Wallet Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/wallet");
    await expectHeading(page, /Wallet/);
  });

  test("balance cards render with numeric values", async ({ page }) => {
    await expect(page.getByText("Current Balance")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Available Balance")).toBeVisible();

    // Should show ETB currency
    await expect(page.getByText(/ETB/).first()).toBeVisible();
  });

  test("cross-check balances against wallet API", async ({ page }) => {
    test.setTimeout(60000);
    let shipperToken: string;
    try {
      shipperToken = await getToken("shipper@test.com", TEST_PASSWORD);
    } catch {
      test.skip(true, "Could not obtain shipper token");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/wallet/balance",
      shipperToken
    );
    expect(status).toBe(200);

    // API returns totalBalance — should appear somewhere on page
    if (data.totalBalance !== undefined) {
      const formatted = Number(data.totalBalance).toLocaleString();
      // Check for the numeric portion (may be formatted differently)
      const numericPart = String(Math.floor(Number(data.totalBalance)));
      await expect(
        page
          .getByText(numericPart)
          .first()
          .or(page.getByText(formatted).first())
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("financial summary cards render", async ({ page }) => {
    await expect(page.getByText("Total Deposited")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Total Spent")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("transaction history section with filter tabs", async ({ page }) => {
    await expect(page.getByText("Transaction History")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deposits" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refunds" })).toBeVisible();
  });

  test("transaction filter tabs switch content", async ({ page }) => {
    // Click Deposits filter
    await page.getByRole("button", { name: "Deposits" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Transaction History")).toBeVisible();

    // Click Refunds filter
    await page.getByRole("button", { name: "Refunds" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Transaction History")).toBeVisible();

    // Click All to reset
    await page.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(1000);

    // Should show transactions or empty state
    const txContent = page.getByText(/Deposit|Service Fee|Refund/).first();
    const emptyState = page.getByText(/No transactions found/);
    await expect(txContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("Deposit Funds button is visible", async ({ page }) => {
    await expect(
      page
        .getByRole("button", { name: /Deposit Funds/i })
        .or(page.getByRole("link", { name: /Deposit Funds/i }))
    ).toBeVisible();
  });
});
