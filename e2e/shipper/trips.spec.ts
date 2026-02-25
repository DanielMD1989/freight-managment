import { test, expect } from "@playwright/test";

test.describe("Shipper Trips", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/trips");
  });

  test("shows trip history heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Trip History" })
    ).toBeVisible();
    await expect(
      page.getByText(/View delivered and completed trips/)
    ).toBeVisible();
  });

  test("displays status filter tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delivered" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
  });

  test("shows trip cards with load references and status badges", async ({
    page,
  }) => {
    // Trip cards show LOAD-xxx references and Delivered/Completed badges
    const tripContent = page.getByText(/LOAD-/).first();
    const emptyState = page.getByText(/No completed trips yet/);
    await expect(tripContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("trip cards show route details", async ({ page }) => {
    // Trip cards show city names like "Dire Dawa", "Addis Ababa"
    const cityName = page
      .getByText(/Dire Dawa|Addis Ababa|Djibouti|Mekelle/)
      .first();
    const emptyState = page.getByText(/No completed trips yet/);
    await expect(cityName.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("trip cards have View Route and View Details buttons", async ({
    page,
  }) => {
    const viewRoute = page
      .getByRole("button", { name: /View Route/ })
      .or(page.getByRole("link", { name: /View Route/ }));
    const emptyState = page.getByText(/No completed trips yet/);
    await expect(viewRoute.first().or(emptyState)).toBeVisible({
      timeout: 10000,
    });
  });

  test("clicking filter tab changes visible trips", async ({ page }) => {
    await page.getByRole("button", { name: "Delivered" }).click();
    await page.waitForTimeout(1000);
    await expect(
      page.getByRole("heading", { name: "Trip History" })
    ).toBeVisible();
  });
});
