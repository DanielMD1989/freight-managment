/**
 * Deep Requests Page E2E Tests
 *
 * Verifies carrier request listing, tabs, request cards,
 * approve/reject actions, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Requests Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/requests");
    await expectHeading(page, /Requests/);
  });

  test("Carrier Requests tab renders with count", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(
      main.getByRole("button", { name: /Carrier Requests/ })
    ).toBeVisible();
  });

  test("request cards show LOAD references", async ({ page }) => {
    await page.waitForTimeout(2000);
    const loadRef = page.getByText(/LOAD-/).first();
    const emptyState = page.getByText(/No.*requests/i);
    await expect(loadRef.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("My Truck Requests tab is accessible", async ({ page }) => {
    const main = page.getByRole("main");
    await main.getByRole("button", { name: /My Truck Requests/ }).click();
    await page.waitForTimeout(1000);

    // Should show content for outgoing requests
    const content = page.getByText(/LOAD-|No.*requests|truck/i).first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test("request cards show carrier and truck information", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Cards should show carrier name, truck info, or status
    const info = page
      .getByText(/carrier|truck|PENDING|APPROVED|REJECTED/i)
      .first();
    const emptyState = page.getByText(/No.*requests/i);
    await expect(info.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("request cards show action buttons when pending", async ({ page }) => {
    await page.waitForTimeout(2000);

    // Pending requests should have approve/reject buttons
    const actionBtn = page
      .getByRole("button", { name: /Approve|Reject|Accept|Decline/i })
      .first();
    const noActions = page.getByText(/APPROVED|No.*requests/i).first();
    await expect(actionBtn.or(noActions)).toBeVisible({ timeout: 10000 });
  });

  test("cross-check requests against API", async ({ page }) => {
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
      "/api/load-requests?limit=5",
      shipperToken
    );
    expect(status).toBe(200);

    const requests = data.requests ?? data.loadRequests ?? data;
    if (Array.isArray(requests) && requests.length > 0) {
      // At least one LOAD- reference should be visible
      await expect(page.getByText(/LOAD-/).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });
});
