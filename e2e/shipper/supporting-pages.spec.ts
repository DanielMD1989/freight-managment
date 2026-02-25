import { test, expect } from "@playwright/test";

test.describe("Shipper Matches Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/matches");
  });

  test("shows truck matches heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Truck Matches" })
    ).toBeVisible();
    await expect(
      page.getByText("Find available carriers for your posted loads")
    ).toBeVisible();
  });
});

test.describe("Shipper Requests Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/requests");
  });

  test("shows requests heading and tabs", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Requests" })).toBeVisible();
    // Tab buttons include counts like "Carrier Requests 1"
    await expect(
      main.getByRole("button", { name: /Carrier Requests/ })
    ).toBeVisible();
    await expect(
      main.getByRole("button", { name: /My Truck Requests/ })
    ).toBeVisible();
  });

  test("shows request content with load references", async ({ page }) => {
    await page.waitForTimeout(2000);
    // Requests page shows LOAD- references in cards
    await expect(page.getByText(/LOAD-/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Shipper Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/settings");
  });

  test("shows company settings heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Company Settings" })
    ).toBeVisible();
    await expect(
      page.getByText("Manage your company profile and preferences")
    ).toBeVisible();
  });

  test("shows company profile form sections", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Company Profile" }).first()
    ).toBeVisible();
    await expect(main.getByText("Company Name *").first()).toBeVisible();
    await expect(main.getByText("Contact Information").first()).toBeVisible();
  });
});

test.describe("Shipper Map Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/map");
  });

  test("shows track shipments heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Track Shipments/ })
    ).toBeVisible();
    await expect(
      page.getByText("Real-time GPS tracking of your active shipments")
    ).toBeVisible();
  });

  test("shows shipment info or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    const shipmentInfo = main
      .getByText(/Status|Carrier|No Active Shipments/)
      .first();
    await expect(shipmentInfo).toBeVisible({ timeout: 10000 });
  });

  test("shows Refresh button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
});

test.describe("Shipper Team Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/team");
  });

  test("shows team management heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Team Management/ })
    ).toBeVisible();
    await expect(
      page.getByText("Manage your company's team members and invitations")
    ).toBeVisible();
  });

  test("shows team sections", async ({ page }) => {
    await page.waitForTimeout(2000);
    const teamContent = page
      .getByText(/Team Members|Active Team Members/)
      .first();
    const emptyState = page.getByText(/No team members/);
    await expect(teamContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });
});
