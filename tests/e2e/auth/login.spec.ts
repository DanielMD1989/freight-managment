/**
 * Blueprint §1 — Login flows
 *
 * Verifies role-based redirect after successful login,
 * wrong-password error, and revoked-account gating.
 */

import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login — role redirects", () => {
  test("shipper login redirects to /shipper", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("shipper@test.com");
    await page.getByLabel(/password/i).fill("Test123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/shipper/, { timeout: 20000 });
  });

  test("carrier login redirects to /carrier", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("carrier@test.com");
    await page.getByLabel(/password/i).fill("Test123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/carrier/, { timeout: 20000 });
  });

  test("admin login redirects to /admin", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@test.com");
    await page.getByLabel(/password/i).fill("Test123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/admin/, { timeout: 20000 });
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("shipper@test.com");
    await page.getByLabel(/password/i).fill("WrongPass999!");
    await page.getByRole("button", { name: /sign in/i }).click();

    const errEl = page
      .getByText(/invalid|incorrect|wrong|credentials|password/i)
      .first();
    await expect(errEl).toBeVisible({ timeout: 10000 });
  });

  test("revoked account is blocked at login", async ({ page }) => {
    const revokedEmail = process.env.REVOKED_TEST_EMAIL;
    if (!revokedEmail) {
      test.skip(
        true,
        "REVOKED_TEST_EMAIL env not set — no revoked test account seeded"
      );
      return;
    }

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(revokedEmail);
    await page
      .getByLabel(/password/i)
      .fill(process.env.REVOKED_TEST_PASSWORD ?? "Test123!");
    await page.getByRole("button", { name: /sign in/i }).click();

    const blockedMsg = page
      .getByText(/revoked|suspended|blocked|access.*denied/i)
      .first();
    await expect(blockedMsg).toBeVisible({ timeout: 10000 });
  });
});
