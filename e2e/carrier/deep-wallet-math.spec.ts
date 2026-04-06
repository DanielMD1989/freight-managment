/**
 * Deep Wallet Math E2E — Carrier Portal
 *
 * Verifies the financial-integrity invariant from commit 9b0ea64:
 *   totalBalance ≈ totalDeposited + totalRefunded
 *                  − serviceFeesPaid − totalWithdrawn
 *
 * Plus cross-checks the rendered UI numbers against the API.
 *
 * Real DB, real browser, real auth — no mocks.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

let token: string;
type WalletApi = {
  totalBalance: number;
  currency: string;
  totalDeposited: number;
  totalRefunded: number;
  serviceFeesPaid: number;
  totalWithdrawn: number;
  ledgerDrift: number;
  isLedgerInSync: boolean;
  wallets: Array<{
    id: string;
    balance: number;
    ledgerDrift: number;
    isLedgerInSync: boolean;
  }>;
};

test.beforeAll(async () => {
  test.setTimeout(60000);
  try {
    token = await getCarrierToken();
  } catch {
    // tests will skip
  }
});

test.describe("Deep: Carrier Wallet — Financial Integrity (9b0ea64)", () => {
  test("FI-1 — API returns the per-category totals", async () => {
    test.skip(!token, "no carrier token");
    const { status, data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty("totalBalance");
    expect(data).toHaveProperty("totalDeposited");
    expect(data).toHaveProperty("totalRefunded");
    expect(data).toHaveProperty("serviceFeesPaid");
    expect(data).toHaveProperty("totalWithdrawn");
    expect(data).toHaveProperty("ledgerDrift");
    expect(data).toHaveProperty("isLedgerInSync");
    console.log("API totals:", {
      totalBalance: data.totalBalance,
      totalDeposited: data.totalDeposited,
      totalRefunded: data.totalRefunded,
      serviceFeesPaid: data.serviceFeesPaid,
      totalWithdrawn: data.totalWithdrawn,
      ledgerDrift: data.ledgerDrift,
      isLedgerInSync: data.isLedgerInSync,
    });
  });

  test("FI-2 — math invariant: balance == deposits + refunds − fees − withdrawals", async () => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    const expected =
      Number(data.totalDeposited) +
      Number(data.totalRefunded) -
      Number(data.serviceFeesPaid) -
      Number(data.totalWithdrawn);
    const drift = Math.abs(Number(data.totalBalance) - expected);
    console.log(
      `balance=${data.totalBalance}, derived=${expected}, drift=${drift}`
    );
    // 0.01 tolerance is what the API uses for isLedgerInSync
    expect(drift).toBeLessThanOrEqual(0.01);
  });

  test("FI-3 — isLedgerInSync flag matches the invariant", async () => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    expect(data.isLedgerInSync).toBe(Math.abs(data.ledgerDrift) <= 0.01);
  });

  test("FI-4 — every wallet account is individually in sync", async () => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    for (const w of data.wallets) {
      console.log(
        `wallet ${w.id}: balance=${w.balance}, drift=${w.ledgerDrift}, inSync=${w.isLedgerInSync}`
      );
      expect(w.isLedgerInSync).toBe(true);
      expect(Math.abs(Number(w.ledgerDrift))).toBeLessThanOrEqual(0.01);
    }
  });
});

test.describe("Deep: Carrier Wallet — UI ⇄ API parity (9b0ea64)", () => {
  test("UI-1 — Total Deposited card matches API totalDeposited", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await expect(page.getByText(/Total Deposited/i).first()).toBeVisible({
      timeout: 10000,
    });
    // The number is rendered with toLocaleString(); take the formatted version
    const formatted = Number(data.totalDeposited).toLocaleString();
    const numericPart = String(Math.floor(Number(data.totalDeposited)));
    console.log(`expecting Total Deposited to show ${formatted}`);
    await expect(
      page
        .getByText(new RegExp(`Total Deposited`, "i"))
        .locator("..")
        .getByText(new RegExp(`${numericPart}|${formatted}`))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("UI-2 — Service Fees Paid card matches API serviceFeesPaid", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await expect(page.getByText(/Service Fees Paid/i).first()).toBeVisible({
      timeout: 10000,
    });
    const numericPart = String(Math.floor(Number(data.serviceFeesPaid)));
    console.log(`expecting Service Fees Paid to show ${numericPart}`);
    await expect(
      page
        .getByText(/Service Fees Paid/i)
        .locator("..")
        .getByText(new RegExp(numericPart))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("UI-3 — Total Withdrawn card matches API totalWithdrawn", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await expect(page.getByText(/Total Withdrawn/i).first()).toBeVisible({
      timeout: 10000,
    });
    const numericPart = String(Math.floor(Number(data.totalWithdrawn)));
    console.log(`expecting Total Withdrawn to show ${numericPart}`);
    await expect(
      page
        .getByText(/Total Withdrawn/i)
        .locator("..")
        .getByText(new RegExp(numericPart))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("UI-4 — Current Balance card matches API totalBalance", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    const numericPart = String(Math.floor(Number(data.totalBalance)));
    const formatted = Number(data.totalBalance).toLocaleString();
    console.log(`expecting Current Balance to show ${formatted}`);
    await expect(
      page
        .getByText(/Current Balance/i)
        .locator("..")
        .getByText(new RegExp(`${numericPart}|${formatted}`))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("UI-5 — drift banner is HIDDEN when wallet is in sync", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    const { data } = await apiCall<WalletApi>(
      "GET",
      "/api/wallet/balance",
      token
    );
    test.skip(
      !data.isLedgerInSync,
      "skipping when wallet has drift; the banner SHOULD show in that case"
    );
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    // The drift warning shouldn't render when in sync
    await expect(
      page.getByText(/ledger drift|Wallet ledger drift detected/i)
    ).toHaveCount(0);
  });
});

test.describe("Deep: Carrier Wallet — Self-service Deposit Form (Blueprint §8)", () => {
  test("DF-1 — Deposit Funds button opens the new request form modal", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await page
      .getByRole("button", { name: /Deposit Funds/i })
      .first()
      .click();
    // The new form has an Amount input — the static info modal did not.
    await expect(page.getByText(/Amount \(ETB\)/i).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/Payment Method/i).first()).toBeVisible();
  });

  test("DF-2 — Form rejects empty amount with inline error", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await page
      .getByRole("button", { name: /Deposit Funds/i })
      .first()
      .click();
    await expect(page.getByText(/Amount \(ETB\)/i).first()).toBeVisible();
    await page.getByRole("button", { name: /Submit Request/i }).click();
    await expect(page.getByText(/Please enter a valid amount/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("DF-3 — Bank transfer requires slip URL", async ({ page }) => {
    test.skip(!token, "no carrier token");
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await page
      .getByRole("button", { name: /Deposit Funds/i })
      .first()
      .click();
    await page.getByPlaceholder(/e\.g\. 5000/).fill("1000");
    // BANK_TRANSFER_SLIP is the default; submit without filling slip URL
    await page.getByRole("button", { name: /Submit Request/i }).click();
    await expect(page.getByText(/slip file URL/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("DF-4 — Telebirr requires transaction reference", async ({ page }) => {
    test.skip(!token, "no carrier token");
    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);
    await page
      .getByRole("button", { name: /Deposit Funds/i })
      .first()
      .click();
    await page.getByPlaceholder(/e\.g\. 5000/).fill("500");
    // Switch to TELEBIRR
    await page.getByRole("combobox").first().selectOption("TELEBIRR");
    await page.getByRole("button", { name: /Submit Request/i }).click();
    await expect(
      page
        .getByText(/Telebirr\/M-Pesa deposits require a transaction reference/i)
        .first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("DF-5 — Successful submission creates a PENDING WalletDeposit via API", async () => {
    test.skip(!token, "no carrier token");
    // Hit the API directly with a valid Telebirr deposit
    const ref = `e2e-carrier-${Date.now()}`;
    const res = await apiCall<{
      message?: string;
      deposit?: { id: string; status: string; amount: number | string };
      error?: string;
    }>("POST", "/api/wallet/deposit", token, {
      amount: 100,
      paymentMethod: "TELEBIRR",
      externalReference: ref,
      notes: "Playwright DF-5 self-service deposit test",
    });
    console.log(`POST /api/wallet/deposit → ${res.status}`, res.data?.error);
    expect([200, 201]).toContain(res.status);
    expect(res.data.deposit?.status).toBe("PENDING");
    expect(Number(res.data.deposit?.amount)).toBe(100);
    expect(res.data.deposit?.id).toBeTruthy();
  });

  test("DF-6 — Submitted deposit appears in GET /api/wallet/deposit", async () => {
    test.skip(!token, "no carrier token");
    const list = await apiCall<{
      deposits: Array<{
        id: string;
        status: string;
        amount: number | string;
        paymentMethod: string;
      }>;
    }>("GET", "/api/wallet/deposit?status=PENDING&limit=5", token);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.data.deposits)).toBe(true);
    // At least one deposit (from DF-5) should exist for this carrier
    expect(list.data.deposits.length).toBeGreaterThan(0);
    console.log(`carrier has ${list.data.deposits.length} pending deposit(s)`);
  });
});
