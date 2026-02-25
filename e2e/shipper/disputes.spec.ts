import { test, expect } from "@playwright/test";

test.describe("Shipper Disputes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/disputes");
  });

  test("shows disputes heading and description", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Disputes" })).toBeVisible();
    await expect(
      page.getByText("Manage and track your disputes")
    ).toBeVisible();
  });

  test("shows File Dispute button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /File Dispute/ })
    ).toBeVisible();
  });

  test("displays status filter tabs", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByRole("button", { name: "All" })).toBeVisible();
    await expect(main.getByRole("button", { name: "OPEN" })).toBeVisible();
    await expect(
      main.getByRole("button", { name: "UNDER REVIEW" })
    ).toBeVisible();
    await expect(main.getByRole("button", { name: "RESOLVED" })).toBeVisible();
    await expect(main.getByRole("button", { name: "CLOSED" })).toBeVisible();
  });

  test("clicking File Dispute opens the form", async ({ page }) => {
    await page.getByRole("button", { name: /File Dispute/ }).click();
    await expect(page.getByText("File a New Dispute")).toBeVisible();
    await expect(page.getByText("Load ID")).toBeVisible();
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
  });

  test("dispute form shows Cancel and Submit buttons", async ({ page }) => {
    await page.getByRole("button", { name: /File Dispute/ }).click();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit Dispute" })
    ).toBeVisible();
  });

  test("cancelling the form closes it", async ({ page }) => {
    await page.getByRole("button", { name: /File Dispute/ }).click();
    await expect(page.getByText("File a New Dispute")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("File a New Dispute")).not.toBeVisible();
  });
});
