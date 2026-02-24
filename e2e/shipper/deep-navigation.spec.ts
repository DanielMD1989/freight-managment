/**
 * Deep Navigation E2E Tests
 *
 * Verifies every shipper page is accessible via URL,
 * sidebar links exist in the DOM, and page headings render.
 */

import { test, expect } from "@playwright/test";
import { expectHeading } from "./test-utils";

test.describe("Deep: All Shipper Pages Accessible", () => {
  const pages: Array<{ url: string; heading: RegExp }> = [
    { url: "/shipper/dashboard", heading: /Welcome back/ },
    { url: "/shipper/loadboard", heading: /Loadboard/ },
    { url: "/shipper/requests", heading: /Requests/ },
    { url: "/shipper/loads", heading: /My Loads/ },
    { url: "/shipper/loads/create", heading: /Post New Load/ },
    { url: "/shipper/trips", heading: /Trip History/ },
    { url: "/shipper/wallet", heading: /Wallet/ },
    { url: "/shipper/documents", heading: /Company Documents/ },
    { url: "/shipper/settings", heading: /Company Settings/ },
    { url: "/shipper/team", heading: /Team Management/ },
    { url: "/shipper/disputes", heading: /Disputes/ },
    { url: "/shipper/map", heading: /Track Shipments/ },
    { url: "/shipper/matches", heading: /Truck Matches/ },
  ];

  for (const { url, heading } of pages) {
    test(`${url} loads with correct heading`, async ({ page }) => {
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: heading }).first()
      ).toBeVisible({ timeout: 10000 });
    });
  }
});

test.describe("Deep: Sidebar Links Exist in DOM", () => {
  test("sidebar contains all navigation links", async ({ page }) => {
    await page.goto("/shipper/dashboard");
    await expectHeading(page, /Welcome back/);

    const expectedLinks = [
      { name: "Dashboard", href: "/shipper/dashboard" },
      { name: "Live Map", href: "/shipper/map" },
      { name: "Loadboard", href: "/shipper/loadboard" },
      { name: "Requests", href: "/shipper/requests" },
      { name: "My Loads", href: "/shipper/loads" },
      { name: "Trips", href: "/shipper/trips" },
      { name: "Wallet", href: "/shipper/wallet" },
      { name: "Documents", href: "/shipper/documents" },
      { name: "Team", href: "/shipper/team" },
    ];

    for (const link of expectedLinks) {
      // Verify link exists in DOM (may be hidden on mobile viewport)
      const el = page.locator(`a[href="${link.href}"]`).first();
      await expect(el).toBeAttached({ timeout: 10000 });
    }
  });

  test("sidebar contains portal branding in DOM", async ({ page }) => {
    await page.goto("/shipper/dashboard");
    await expectHeading(page, /Welcome back/);

    await expect(page.getByText(/FreightET/i).first()).toBeAttached({
      timeout: 10000,
    });
  });
});

test.describe("Deep: Cross-Page Navigation", () => {
  test("navigating between pages preserves auth state", async ({ page }) => {
    // Start at dashboard
    await page.goto("/shipper/dashboard");
    await expectHeading(page, /Welcome back/);

    // Navigate to loads
    await page.goto("/shipper/loads");
    await expectHeading(page, /My Loads/);

    // Navigate to wallet
    await page.goto("/shipper/wallet");
    await expectHeading(page, /Wallet/);

    // Navigate back to dashboard
    await page.goto("/shipper/dashboard");
    await expectHeading(page, /Welcome back/);
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    // Create a new context without stored auth state
    const context = await page
      .context()
      .browser()!
      .newContext({
        storageState: { cookies: [], origins: [] },
      });
    const freshPage = await context.newPage();

    await freshPage.goto("/shipper/dashboard");
    await freshPage.waitForURL("**/login**", { timeout: 10000 });

    await context.close();
  });
});
