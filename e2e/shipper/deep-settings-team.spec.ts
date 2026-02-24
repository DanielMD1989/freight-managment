/**
 * Deep Settings & Team Pages E2E Tests
 *
 * Verifies company profile form, contact info,
 * team management, and member listing.
 */

import { test, expect } from "@playwright/test";
import { expectHeading } from "./test-utils";

test.describe("Deep: Company Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/settings");
    await expectHeading(page, /Company Settings/);
  });

  test("company profile form renders with fields", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Company Profile" }).first()
    ).toBeVisible();
    await expect(main.getByText("Company Name *").first()).toBeVisible();
  });

  test("contact information section is visible", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Contact Information").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("company settings form has Save button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Save|Update/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("manage preferences section visible", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Manage your company profile|preferences/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Deep: Team Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/team");
    await expectHeading(page, /Team Management/);
  });

  test("team page renders with description", async ({ page }) => {
    await expect(
      page.getByText("Manage your company's team members and invitations")
    ).toBeVisible();
  });

  test("team members section shows list or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const teamContent = page
      .getByText(/Team Members|Active Team Members/)
      .first();
    const emptyState = page.getByText(/No team members/);
    await expect(teamContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("invite button is accessible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Invite Member/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
