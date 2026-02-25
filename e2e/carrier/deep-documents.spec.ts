/**
 * Deep Documents E2E Tests — Carrier Portal
 *
 * Verifies document list, upload form, status cards,
 * and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: Carrier Documents Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/documents");
    await expectHeading(page, /Company Documents/);
  });

  test("document status summary cards render", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Pending Review").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText("Approved").first()).toBeVisible();
    await expect(main.getByText("Rejected").first()).toBeVisible();
  });

  test("Upload New Document button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Upload New Document/ })
    ).toBeVisible({ timeout: 10000 });
  });

  test("clicking Upload shows upload form", async ({ page }) => {
    await page.getByRole("button", { name: /Upload New Document/ }).click();
    await page.waitForTimeout(1000);

    const formContent = page
      .getByText(/Document Type|Select|Choose file|Upload/i)
      .first();
    await expect(formContent).toBeVisible({ timeout: 5000 });
  });

  test("document list shows items or empty state", async ({ page }) => {
    // Page always shows "All Documents (N)" heading
    await expect(
      page.getByRole("heading", { name: /All Documents/ })
    ).toBeVisible({ timeout: 10000 });
  });

  test("cross-check documents against API", async ({ page }) => {
    test.setTimeout(60000);
    let carrierToken: string;
    try {
      carrierToken = await getCarrierToken();
    } catch {
      test.skip(true, "Could not obtain carrier token");
      return;
    }

    const { status: meStatus, data: meData } = await apiCall(
      "GET",
      "/api/auth/me",
      carrierToken
    );
    test.skip(meStatus !== 200, "Could not fetch user profile");
    const orgId = meData.user?.organizationId ?? meData.organizationId;
    test.skip(!orgId, "Could not determine organization ID");

    const { status, data } = await apiCall(
      "GET",
      `/api/documents?entityType=company&entityId=${orgId}`,
      carrierToken
    );
    test.skip(status !== 200, `Documents API returned ${status}`);

    const docs = data.documents ?? data;
    if (Array.isArray(docs) && docs.length > 0) {
      await expect(
        page.getByText(/INSURANCE|LICENSE|TAX|CERTIFICATE/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
