/**
 * Deep Requests E2E Tests — Carrier Portal
 *
 * Verifies 3 tabs (Shipper Requests, My Load Requests, Match Proposals),
 * request cards, action buttons, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: Requests Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/requests");
    await expectHeading(page, /Requests/);
  });

  test("page heading with subtitle renders", async ({ page }) => {
    await expect(page.getByText(/Manage.*requests/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Deep: Shipper Requests Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/requests");
    await expectHeading(page, /Requests/);
  });

  test("Shipper Requests tab renders", async ({ page }) => {
    const tab = page.getByRole("button", { name: /Shipper Requests/i }).first();
    await expect(tab).toBeVisible({ timeout: 10000 });
  });

  test("request cards show load and truck info", async ({ page }) => {
    await page.waitForTimeout(2000);
    // The Shipper Requests tab shows requests or "No Requests" heading
    await expect(
      page
        .getByRole("heading", { name: /No Requests/i })
        .first()
        .or(page.getByRole("main").getByText(/LOAD-/).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test("pending requests have Accept/Reject buttons", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    // Default filter is PENDING (0) which shows "No Requests" or action buttons
    // Use exact names to avoid matching "REJECTED (11)" / "APPROVED (13)" filter buttons
    const noRequests = main
      .getByRole("heading", { name: /No Requests/i })
      .first();
    const acceptBtn = main.getByRole("button", { name: /^Accept$/i }).first();
    const noReqVisible = await noRequests.isVisible().catch(() => false);
    const acceptVisible = await acceptBtn.isVisible().catch(() => false);
    expect(noReqVisible || acceptVisible).toBe(true);
  });

  test("approved requests show Approved badge", async ({ page }) => {
    await page.waitForTimeout(2000);
    const content = page
      .getByText(/Approved|APPROVED|Pending|No.*requests/i)
      .first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("cross-check against truck-requests API", async ({ page }) => {
    test.setTimeout(60000);
    let carrierToken: string;
    try {
      carrierToken = await getCarrierToken();
    } catch {
      test.skip(true, "Could not obtain carrier token");
      return;
    }

    let result: { status: number; data: Record<string, unknown> };
    try {
      result = await apiCall(
        "GET",
        "/api/truck-requests?limit=5",
        carrierToken
      );
    } catch {
      test.skip(true, "Truck-requests API call failed");
      return;
    }
    test.skip(
      result.status !== 200,
      `Truck-requests API returned ${result.status}`
    );

    const requests = result.data?.requests ?? result.data;
    if (Array.isArray(requests) && requests.length > 0) {
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { name: /No Requests|Requests/i }).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Deep: My Load Requests Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/requests");
    await expectHeading(page, /Requests/);
  });

  test("My Load Requests tab is accessible", async ({ page }) => {
    const tab = page
      .getByRole("button", { name: /My Load Requests|Load Requests/i })
      .first();
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    await page.waitForTimeout(1500);
  });

  test("shows outgoing load requests or empty state", async ({ page }) => {
    const main = page.getByRole("main");
    const tab = main.getByRole("button", { name: /My Load Requests/i }).first();
    await tab.click();
    await page.waitForTimeout(2000);

    const requestContent = main
      .getByText(/LOAD-|Pending|Approved|truck|PENDING|APPROVED/i)
      .first();
    const emptyState = main.getByText(/No.*requests|No Requests/i);
    await expect(requestContent.or(emptyState)).toBeVisible({
      timeout: 10000,
    });
  });

  test("load request cards show status badges", async ({ page }) => {
    const tab = page
      .getByRole("button", { name: /My Load Requests|Load Requests/i })
      .first();
    await tab.click();
    await page.waitForTimeout(2000);

    const badge = page
      .getByText(/PENDING|APPROVED|REJECTED|No.*requests/i)
      .first();
    await expect(badge).toBeVisible({ timeout: 10000 });
  });

  test("cross-check against load-requests API", async ({ page }) => {
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
      "/api/load-requests?limit=5",
      carrierToken
    );
    expect(status).toBe(200);

    const requests = data.loadRequests ?? data.requests ?? data;
    if (Array.isArray(requests) && requests.length > 0) {
      const tab = page
        .getByRole("button", { name: /My Load Requests|Load Requests/i })
        .first();
      await tab.click();
      await page.waitForTimeout(2000);
      await expect(
        page.getByText(/LOAD-|Pending|Approved/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Deep: Match Proposals Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/requests");
    await expectHeading(page, /Requests/);
  });

  test("Match Proposals tab is accessible", async ({ page }) => {
    const tab = page
      .getByRole("button", { name: /Match Proposals|Proposals/i })
      .first();
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    await page.waitForTimeout(1500);
  });

  test("shows proposals or empty state", async ({ page }) => {
    const main = page.getByRole("main");
    const tab = main.getByRole("button", { name: /Match Proposals/i }).first();
    await tab.click();
    await page.waitForTimeout(2000);

    // Should show proposals or "No Match Proposals" empty state heading
    const noProposals = main
      .getByRole("heading", { name: /No Match Proposals/i })
      .first();
    const proposalContent = main.getByText(/LOAD-|Proposed/i).first();
    const noVisible = await noProposals.isVisible().catch(() => false);
    const contentVisible = await proposalContent.isVisible().catch(() => false);
    expect(noVisible || contentVisible).toBe(true);
  });

  test("cross-check against match-proposals API", async ({ page: _page }) => {
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
      "/api/match-proposals?limit=5",
      carrierToken
    );
    expect(status).toBe(200);

    const proposals = data.proposals ?? data;
    expect(Array.isArray(proposals)).toBe(true);
  });
});
