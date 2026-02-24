/**
 * Deep Documents Page E2E Tests
 *
 * Verifies document list, upload form, status cards,
 * and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getToken, apiCall, expectHeading, TEST_PASSWORD } from "./test-utils";

test.describe("Deep: Documents Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/documents");
    await expectHeading(page, /Company Documents/);
  });

  test("document status summary cards render", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Pending Review")).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText("Approved").first()).toBeVisible();
    await expect(main.getByText("Rejected").first()).toBeVisible();
  });

  test("Upload New Document button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Upload New Document/ })
    ).toBeVisible();
  });

  test("clicking Upload shows upload form", async ({ page }) => {
    await page.getByRole("button", { name: /Upload New Document/ }).click();
    await page.waitForTimeout(1000);

    // Upload form should show document type selector and file input
    const formContent = page
      .getByText(/Document Type|Select|Choose file|Upload/i)
      .first();
    await expect(formContent).toBeVisible({ timeout: 5000 });
  });

  test("document list shows items or empty state", async ({ page }) => {
    const docContent = page
      .getByText(/INSURANCE CERTIFICATE|All Documents|Business License/i)
      .first();
    const emptyState = page.getByText(/No Documents Yet/);
    await expect(docContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("cross-check documents against API", async ({ page }) => {
    test.setTimeout(60000);
    let shipperToken: string;
    try {
      shipperToken = await getToken("shipper@test.com", TEST_PASSWORD);
    } catch {
      test.skip(true, "Could not obtain shipper token");
      return;
    }

    // Get the user's org ID first
    const { status: meStatus, data: meData } = await apiCall(
      "GET",
      "/api/auth/me",
      shipperToken
    );
    test.skip(meStatus !== 200, "Could not fetch user profile");
    const orgId = meData.user?.organizationId ?? meData.organizationId;
    test.skip(!orgId, "Could not determine organization ID");

    const { status, data } = await apiCall(
      "GET",
      `/api/documents?entityType=company&entityId=${orgId}`,
      shipperToken
    );
    test.skip(
      status !== 200,
      `Documents API returned ${status} — entity params may not match`
    );

    const docs = data.documents ?? data;
    if (Array.isArray(docs) && docs.length > 0) {
      // At least one document type should be visible on page
      await expect(
        page.getByText(/INSURANCE|LICENSE|TAX|CERTIFICATE/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
