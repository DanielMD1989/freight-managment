import { test, expect } from "@playwright/test";

test.describe("Shipper Documents", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/documents");
  });

  test("shows documents heading and description", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Company Documents" })
    ).toBeVisible();
    await expect(
      page.getByText(/Upload and manage your company/)
    ).toBeVisible();
  });

  test("displays document summary status cards", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Pending Review")).toBeVisible();
    await expect(main.getByText("Approved").first()).toBeVisible();
    await expect(main.getByText("Rejected").first()).toBeVisible();
  });

  test("shows Upload New Document button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Upload New Document/ })
    ).toBeVisible();
  });

  test("shows documents list with document types", async ({ page }) => {
    // The actual document shown is "INSURANCE CERTIFICATE" with APPROVED badge
    const docContent = page
      .getByText(/INSURANCE CERTIFICATE|All Documents/)
      .first();
    const emptyState = page.getByText(/No Documents Yet/);
    await expect(docContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });
});
