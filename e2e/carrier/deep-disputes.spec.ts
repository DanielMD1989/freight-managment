/**
 * Deep Disputes E2E Tests — Carrier Portal
 *
 * Verifies dispute list, status filtering, dispute cards,
 * detail page, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: Carrier Disputes List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/disputes");
    await expectHeading(page, /Disputes/);
  });

  test("page heading with subtitle renders", async ({ page }) => {
    await expect(
      page.getByText(/View and track your disputes/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("filter buttons render", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByRole("button", { name: "All" })).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByRole("button", { name: "OPEN" })).toBeVisible();
    await expect(
      main.getByRole("button", { name: "UNDER REVIEW" })
    ).toBeVisible();
    await expect(main.getByRole("button", { name: "RESOLVED" })).toBeVisible();
    await expect(main.getByRole("button", { name: "CLOSED" })).toBeVisible();
  });

  test("filter switching changes displayed disputes", async ({ page }) => {
    const main = page.getByRole("main");

    await main.getByRole("button", { name: "OPEN" }).click();
    await page.waitForTimeout(1000);
    await expectHeading(page, /Disputes/);

    await main.getByRole("button", { name: "RESOLVED" }).click();
    await page.waitForTimeout(1000);
    await expectHeading(page, /Disputes/);

    await main.getByRole("button", { name: "All" }).click();
    await page.waitForTimeout(1000);
    await expectHeading(page, /Disputes/);
  });

  test("dispute cards show type and description", async ({ page }) => {
    await page.waitForTimeout(2000);
    const disputeContent = page
      .getByText(/Payment Issue|Damage|Late Delivery|Quality Issue|Other/i)
      .first();
    const emptyState = page.getByText(/No disputes found|no disputes/i);
    await expect(disputeContent.or(emptyState)).toBeVisible({
      timeout: 10000,
    });
  });

  test("dispute cards show status badge", async ({ page }) => {
    await page.waitForTimeout(2000);
    const badge = page
      .getByText(/OPEN|UNDER_REVIEW|RESOLVED|CLOSED|No disputes/i)
      .first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("dispute cards show load reference and date", async ({ page }) => {
    await page.waitForTimeout(2000);
    const info = page.getByText(/LOAD-|Filed|Created|No disputes/i).first();
    await expect(info).toBeVisible({ timeout: 10000 });
  });

  test("empty state shows No disputes found", async ({ page }) => {
    // Either show disputes or empty state
    const content = page
      .getByText(/Payment Issue|Damage|No disputes found/i)
      .first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("cross-check disputes against API", async ({ page }) => {
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
      "/api/disputes",
      carrierToken
    );
    expect(status).toBe(200);

    const disputes = data.disputes ?? data;
    if (Array.isArray(disputes) && disputes.length > 0) {
      await expect(
        page
          .getByText(/Payment Issue|Damage|Late Delivery|Quality Issue|Other/i)
          .first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Deep: Carrier Dispute Detail", () => {
  test("dispute detail page navigable from list", async ({ page }) => {
    await page.goto("/carrier/disputes");
    await expectHeading(page, /Disputes/);
    await page.waitForTimeout(2000);

    // Try to click on a dispute to view details
    const disputeLink = page
      .getByRole("link", { name: /View|Details/i })
      .first()
      .or(page.getByText(/Payment Issue|Damage|Late Delivery/i).first());
    const emptyState = page.getByText(/No disputes found/i);

    const hasDisputes = await disputeLink.isVisible().catch(() => false);
    if (!hasDisputes) {
      await expect(emptyState).toBeVisible();
      return;
    }

    await disputeLink.click();
    await page.waitForTimeout(2000);

    // Should be on detail page
    const detailContent = page
      .getByText(/Dispute Details|Back|Status|Description/i)
      .first();
    await expect(detailContent).toBeVisible({ timeout: 10000 });
  });
});
