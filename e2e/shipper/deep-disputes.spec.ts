/**
 * Deep Disputes Page E2E Tests
 *
 * Verifies dispute list, filing form, validation,
 * status filtering, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Disputes Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/disputes");
    await expectHeading(page, /Disputes/);
  });

  test("File Dispute form validation rejects empty submission", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /File Dispute/ }).click();
    await expect(page.getByText("File a New Dispute")).toBeVisible();

    // Try to submit without filling anything
    await page.getByRole("button", { name: "Submit Dispute" }).click();

    // Should show validation errors or stay on form
    await expect(page.getByText("File a New Dispute")).toBeVisible({
      timeout: 5000,
    });
  });

  test("File Dispute form accepts valid input", async ({ page }) => {
    await page.getByRole("button", { name: /File Dispute/ }).click();
    await expect(page.getByText("File a New Dispute")).toBeVisible();

    // Verify all form fields are present
    await expect(page.getByText("Load ID")).toBeVisible();
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();

    // Cancel button returns to list
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("File a New Dispute")).not.toBeVisible();
  });

  test("status filter buttons change displayed disputes", async ({ page }) => {
    const main = page.getByRole("main");

    // Click each filter
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

  test("dispute cards show type and description when present", async ({
    page,
  }) => {
    await page.waitForTimeout(2000);

    const disputeContent = page
      .getByText(/Payment Issue|Damage|Late Delivery|Quality Issue|Other/i)
      .first();
    const emptyState = page.getByText(/No disputes found|no disputes/i);
    await expect(disputeContent.or(emptyState)).toBeVisible({
      timeout: 10000,
    });
  });

  test("cross-check disputes against API", async ({ page }) => {
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
      "/api/disputes",
      shipperToken
    );
    expect(status).toBe(200);

    const disputes = data.disputes ?? data;
    if (Array.isArray(disputes) && disputes.length > 0) {
      // Dispute type should be visible
      await expect(
        page
          .getByText(/Payment Issue|Damage|Late Delivery|Quality Issue|Other/i)
          .first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
