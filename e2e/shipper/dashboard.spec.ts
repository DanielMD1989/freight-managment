import { test, expect } from "@playwright/test";

test.describe("Shipper Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/dashboard");
  });

  test("shows welcome message with user name", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Welcome back/ })
    ).toBeVisible();
  });

  test("displays stat cards with labels", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Total Loads Posted")).toBeVisible();
    await expect(main.getByText("Active Shipments").first()).toBeVisible();
    await expect(main.getByText("Delivered This Month")).toBeVisible();
    await expect(main.getByText("Pending Loads")).toBeVisible();
    await expect(main.getByText("Total Spent")).toBeVisible();
  });

  test("shows quick action buttons with correct links", async ({ page }) => {
    const postLoad = page.getByRole("link", { name: /Post New Load/ }).first();
    await expect(postLoad).toBeVisible();
    await expect(postLoad).toHaveAttribute("href", /\/shipper\/loads\/create/);

    const trackShipments = page.getByRole("link", { name: /Track Shipments/ });
    await expect(trackShipments).toBeVisible();

    const findTrucks = page.getByRole("link", { name: /Find Trucks/ });
    await expect(findTrucks).toBeVisible();
  });

  test("displays dashboard sections", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Quick Actions")).toBeVisible();
    await expect(main.getByText("Active Shipments").first()).toBeVisible();
    await expect(main.getByText("Recent Activity")).toBeVisible();
    await expect(main.getByText("My Posted Loads")).toBeVisible();
  });

  test("shows currency values in ETB", async ({ page }) => {
    await expect(page.getByText(/ETB/).first()).toBeVisible();
  });

  test("clicking Post New Load navigates to create page", async ({ page }) => {
    await page
      .getByRole("link", { name: /Post New Load/ })
      .first()
      .click();
    await page.waitForURL("**/shipper/loads/create**");
    await expect(
      page.getByRole("heading", { name: /Post New Load/ })
    ).toBeVisible();
  });
});
