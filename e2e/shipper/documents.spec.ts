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

  test("shows Upload New Document button or lock banner (org may be approved)", async ({
    page,
  }) => {
    // When org is not yet approved: upload button is visible
    // When org documents are locked after approval: lock banner is shown instead
    const uploadBtn = page.getByRole("button", { name: /Upload New Document/ });
    const lockBanner = page.getByText(/Documents are locked/);
    await expect(uploadBtn.or(lockBanner).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows documents list with document types", async ({ page }) => {
    const docContent = page
      .getByText(/Insurance Certificate|All Documents|Document Type/i)
      .first();
    const emptyState = page.getByText(/No Documents Yet|No documents/i);
    await expect(docContent.or(emptyState).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
