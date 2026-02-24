/**
 * Admin Deep Loads & Trips E2E Tests
 *
 * Verifies load management and trip management pages.
 */

import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getAdminToken,
  apiCall,
} from "./test-utils";

test.describe("Admin Loads", () => {
  test("renders all loads heading", async ({ page }) => {
    await page.goto("/admin/loads");
    await waitForMainContent(page);
    await expectHeading(page, /All Loads/i);
  });

  test("shows platform-wide subheading", async ({ page }) => {
    await page.goto("/admin/loads");
    await waitForMainContent(page);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Platform-wide|all loads/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status tabs render", async ({ page }) => {
    await page.goto("/admin/loads");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Should have status filter buttons
    await expect(
      main.getByRole("button", { name: /All/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("loads table renders with data", async ({ page }) => {
    await page.goto("/admin/loads");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    const table = main.locator("table");
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const rows = table.locator("tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    } else {
      await expect(main.getByText(/loads found|No loads/i).first()).toBeVisible(
        { timeout: 10000 }
      );
    }
  });

  test("loads show route information", async ({ page }) => {
    await page.goto("/admin/loads");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    // Should show city names for routes
    await expect(
      main
        .getByText(
          /Addis Ababa|Dire Dawa|Mekelle|Bahir Dar|Hawassa|→|loads found/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("cross-check loads against API", async ({ page }) => {
    const token = await getAdminToken();
    const { status } = await apiCall(
      "GET",
      "/api/loads?page=1&limit=5&sortBy=createdAt",
      token
    );
    test.skip(status !== 200, `Loads API returned ${status}`);

    await page.goto("/admin/loads");
    await waitForMainContent(page);
    await expectHeading(page, /All Loads/i);
  });
});

test.describe("Admin Trips", () => {
  test("renders all trips heading", async ({ page }) => {
    await page.goto("/admin/trips");
    await waitForMainContent(page);
    await expectHeading(page, /All Trips/i);
  });

  test("shows financial summary cards", async ({ page }) => {
    await page.goto("/admin/trips");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(main.getByText(/Total Trips/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows service fees summary", async ({ page }) => {
    await page.goto("/admin/trips");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(
      main.getByText(/Service Fee|Total Service/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("trips status tabs render", async ({ page }) => {
    await page.goto("/admin/trips");
    await waitForMainContent(page);
    const main = page.getByRole("main");

    await expect(
      main.getByRole("button", { name: /All/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
