/**
 * Deep Navigation E2E Tests — Carrier Portal
 *
 * Verifies every carrier page is accessible via URL,
 * sidebar links exist in the DOM, and page headings render.
 */

import { test, expect } from "@playwright/test";
import { expectHeading } from "./test-utils";

test.describe("Deep: All Carrier Pages Accessible", () => {
  const pages: Array<{ url: string; heading: RegExp }> = [
    { url: "/carrier/dashboard", heading: /Welcome back/ },
    { url: "/carrier/loadboard", heading: /Loadboard/ },
    { url: "/carrier/trucks", heading: /My Trucks/ },
    { url: "/carrier/trucks/add", heading: /Register New Truck/ },
    { url: "/carrier/trips", heading: /My Trips/ },
    { url: "/carrier/trip-history", heading: /Trip History/ },
    { url: "/carrier/requests", heading: /Requests/ },
    { url: "/carrier/matches", heading: /Load Matches/ },
    { url: "/carrier/wallet", heading: /Wallet/ },
    { url: "/carrier/documents", heading: /Company Documents/ },
    { url: "/carrier/settings", heading: /Company Settings/ },
    { url: "/carrier/team", heading: /Team Management/ },
    { url: "/carrier/gps", heading: /GPS Tracking/ },
    { url: "/carrier/map", heading: /Fleet Tracker/ },
    { url: "/carrier/disputes", heading: /Disputes/ },
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

test.describe("Deep: Carrier Sidebar Links Exist in DOM", () => {
  test("sidebar contains all navigation links", async ({ page }) => {
    await page.goto("/carrier/dashboard");
    await expectHeading(page, /Welcome back/);

    const expectedLinks = [
      { name: "Dashboard", href: "/carrier/dashboard" },
      { name: "Map", href: "/carrier/map" },
      { name: "Loadboard", href: "/carrier/loadboard" },
      { name: "Requests", href: "/carrier/requests" },
      { name: "My Trucks", href: "/carrier/trucks" },
      { name: "Trips", href: "/carrier/trips" },
      { name: "GPS Tracking", href: "/carrier/gps" },
      { name: "Wallet", href: "/carrier/wallet" },
      { name: "Documents", href: "/carrier/documents" },
    ];

    for (const link of expectedLinks) {
      const el = page.locator(`a[href="${link.href}"]`).first();
      await expect(el).toBeAttached({ timeout: 10000 });
    }
  });

  test("sidebar contains portal branding in DOM", async ({ page }) => {
    await page.goto("/carrier/dashboard");
    await expectHeading(page, /Welcome back/);

    await expect(page.getByText(/FreightET/i).first()).toBeAttached({
      timeout: 10000,
    });
  });
});

test.describe("Deep: Cross-Page Navigation", () => {
  test("navigating between pages preserves auth state", async ({ page }) => {
    await page.goto("/carrier/dashboard");
    await expectHeading(page, /Welcome back/);

    await page.goto("/carrier/trucks");
    await expectHeading(page, /My Trucks/);

    await page.goto("/carrier/wallet");
    await expectHeading(page, /Wallet/);

    await page.goto("/carrier/dashboard");
    await expectHeading(page, /Welcome back/);
  });

  test("unauthenticated access redirects to login", async ({ page }) => {
    const context = await page
      .context()
      .browser()!
      .newContext({
        storageState: { cookies: [], origins: [] },
      });
    const freshPage = await context.newPage();

    await freshPage.goto("/carrier/dashboard");
    await freshPage.waitForURL("**/login**", { timeout: 10000 });

    await context.close();
  });
});
