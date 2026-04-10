import { test, expect } from "@playwright/test";

test.describe("Shipper Wallet", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/wallet");
  });

  test("shows wallet heading and description", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible();
    await expect(
      page.getByText("Manage your balance and view transactions")
    ).toBeVisible();
  });

  test("displays balance card with Current Balance label", async ({ page }) => {
    await expect(page.getByText("Current Balance")).toBeVisible();
    await expect(page.getByText("Available Balance")).toBeVisible();
  });

  test("shows financial summary cards", async ({ page }) => {
    await expect(page.getByText("Total Deposited")).toBeVisible();
    await expect(page.getByText("Service Fees Paid")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();
  });

  test("displays transaction filter tabs", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Transaction History" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deposits" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refunds", exact: true })
    ).toBeVisible();
  });

  test("shows transactions or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const txVisible = await page
      .getByText(/Deposit|Service Fee|Refund/)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const emptyVisible = await page
      .getByText(/No transactions found/)
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(txVisible || emptyVisible).toBeTruthy();
  });

  test("switching transaction filter updates view", async ({ page }) => {
    await page.getByRole("button", { name: "Deposits" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Transaction History")).toBeVisible();
  });

  test("shows Deposit Funds button", async ({ page }) => {
    await expect(
      page
        .getByRole("button", { name: /Deposit Funds/i })
        .or(page.getByRole("link", { name: /Deposit Funds/i }))
    ).toBeVisible();
  });
});
