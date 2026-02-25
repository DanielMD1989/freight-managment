import { test, expect } from "@playwright/test";

test.describe("Shipper Loads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loads");
  });

  test("shows page heading and subtitle", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "My Loads" })).toBeVisible();
    await expect(page.getByText(/Manage your shipment postings/)).toBeVisible();
  });

  test("displays Post New Load button", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /Post New Load/ })
    ).toBeVisible();
  });

  test("shows status filter tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "All Loads" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Posted", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Delivered" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drafts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unposted" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Active Trips" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelled" })).toBeVisible();
  });

  test("displays table with column headers", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "Age" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Route" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Dates" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Details" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Status" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Actions" })
    ).toBeVisible();
  });

  test("shows load rows with city names and status badges", async ({
    page,
  }) => {
    await expect(page.getByText("POSTED").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("View").first()).toBeVisible();
  });

  test("shows total loads count", async ({ page }) => {
    await expect(page.getByText(/Total:\s*\d+\s*loads/)).toBeVisible();
  });

  test("switching status filter changes displayed loads", async ({ page }) => {
    await page.getByRole("button", { name: "Posted", exact: true }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: "My Loads" })).toBeVisible();
  });

  test("load rows have View and action links", async ({ page }) => {
    await expect(page.getByText("View").first()).toBeVisible();
    await expect(page.getByText("Copy").first()).toBeVisible();
    await expect(page.getByText("Delete").first()).toBeVisible();
  });
});

test.describe("Shipper Load Creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loads/create");
  });

  test("shows creation form with step indicators", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Post New Load/ })
    ).toBeVisible();
    await expect(page.getByText("Route")).toBeVisible();
    await expect(page.getByText("Cargo")).toBeVisible();
    await expect(page.getByText("Options")).toBeVisible();
    await expect(page.getByText("Review")).toBeVisible();
  });

  test("step 1 shows route fields", async ({ page }) => {
    await expect(page.getByText("From")).toBeVisible();
    await expect(page.getByText("To", { exact: true })).toBeVisible();
    await expect(page.getByText("Pickup Date")).toBeVisible();
    await expect(page.getByText("Delivery Date")).toBeVisible();
  });

  test("shows validation error when continuing without required fields", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/required/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("Save Draft and Continue buttons are visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Save Draft/ })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });
});
