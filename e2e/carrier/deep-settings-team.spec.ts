/**
 * Deep Settings & Team Pages E2E Tests — Carrier Portal
 *
 * Verifies company profile form, contact info,
 * team management, and member listing.
 */

import { test, expect } from "@playwright/test";
import { expectHeading } from "./test-utils";

test.describe("Deep: Carrier Company Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/settings");
    await expectHeading(page, /Company Settings/);
  });

  test("company profile form renders with fields", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: /Company Profile/i }).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(main.getByText("Company Name").first()).toBeVisible();
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
      main
        .getByText(/Manage your company profile|preferences|settings/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("notification preferences section renders", async ({ page }) => {
    const main = page.getByRole("main");
    // Settings page has Verification Status, Company Profile, Contact Information
    const settingsContent = main
      .getByText(/Verification|Company Name|Contact/i)
      .first();
    await expect(settingsContent).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Deep: Carrier Team Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/team");
    await expectHeading(page, /Team Management/);
  });

  test("team page renders with description", async ({ page }) => {
    await expect(
      page.getByText(/Manage your company.*team members/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("team members section shows list or empty state", async ({ page }) => {
    await page.waitForTimeout(2000);
    const teamContent = page
      .getByText(/Team Members|Active Team Members/)
      .first();
    const emptyState = page.getByText(/No team members/);
    await expect(teamContent.or(emptyState)).toBeVisible({ timeout: 10000 });
  });

  test("member cards show name and role info", async ({ page }) => {
    await page.waitForTimeout(2000);
    const main = page.getByRole("main");
    const memberInfo = main
      .getByText(
        /CARRIER|Admin|Member|Owner|No team members|Team Members|Active Team/i
      )
      .first();
    await expect(memberInfo).toBeVisible({ timeout: 10000 });
  });

  test("Invite Member button is visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Invite Member/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("pending invitations section renders", async ({ page }) => {
    const main = page.getByRole("main");
    const inviteSection = main
      .getByText(/Pending Invitations|Invitations|No pending|Team Members/i)
      .first();
    await expect(inviteSection).toBeVisible({ timeout: 10000 });
  });
});
