/**
 * Deep Dashboard E2E Tests — Carrier Portal
 *
 * Verifies KPI stat cards, quick actions, dashboard sections,
 * and cross-checks displayed data against the API.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, expectHeading } from "./test-utils";

test.describe("Deep: Carrier Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/dashboard");
    await expectHeading(page, /Welcome back/);
  });

  test("KPI stat cards render with labels", async ({ page }) => {
    const main = page.getByRole("main");

    const cards = [
      "Total Trucks",
      "Available Trucks",
      "Trucks on Job",
      "Pending Approvals",
      "Wallet Balance",
    ];

    for (const label of cards) {
      await expect(main.getByText(label).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("at least one stat card shows numeric value", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText(/\d/).first()).toBeVisible({ timeout: 10000 });
  });

  test("cross-check stats against carrier dashboard API", async ({ page }) => {
    test.setTimeout(60000);
    let carrierToken: string;
    try {
      carrierToken = await getCarrierToken();
    } catch {
      test.skip(true, "Could not obtain carrier token");
      return;
    }

    const { status, data } = await apiCall(
      "GET",
      "/api/carrier/dashboard",
      carrierToken
    );
    expect(status).toBe(200);

    const main = page.getByRole("main");
    if (data.totalTrucks !== undefined) {
      await expect(
        main.getByText(String(data.totalTrucks)).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("Quick Actions section renders with buttons", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Quick Actions").first()).toBeVisible({
      timeout: 10000,
    });

    await expect(
      main.getByRole("link", { name: /Post Truck/ }).first()
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: /Search Loads/ }).first()
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: /Register Truck/ }).first()
    ).toBeVisible();
  });

  test("Post Truck quick action navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /Post Truck/ }).click();
    await page.waitForURL("**/carrier/loadboard**", { timeout: 10000 });
    await expectHeading(page, /Loadboard/);
  });

  test("Register Truck quick action navigates correctly", async ({ page }) => {
    await page.getByRole("link", { name: /Register Truck/ }).click();
    await page.waitForURL("**/carrier/trucks/add**", { timeout: 10000 });
    await expectHeading(page, /Register New Truck/);
  });

  test("My Active Jobs section renders", async ({ page }) => {
    const main = page.getByRole("main");
    const section = main.getByText("My Active Jobs").first();
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("Fleet Overview section renders", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Fleet Overview").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Recent Activity section renders", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Recent Activity").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
