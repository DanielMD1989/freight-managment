import { test, expect } from "@playwright/test";

// These tests verify the login page UI and auth guard.
// The actual "login works" is proven by auth.setup.ts — if setup fails,
// all downstream tests fail too.

test.describe("Shipper Auth", () => {
  // Use fresh browser context (no saved auth) for login page tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page shows form fields and branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(
      page.getByText("Sign in to your account to continue")
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("FreightET").first()).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("wrong@test.com");
    await page.getByLabel("Password").fill("WrongPass1!");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should show an error message (red box above form)
    await expect(page.locator('[class*="red"]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("auth guard redirects unauthenticated user to login", async ({
    page,
  }) => {
    await page.goto("/shipper/dashboard");

    // Should be redirected to login page
    await page.waitForURL("**/login**", { timeout: 10000 });
    await expect(page.getByLabel("Email address")).toBeVisible();
  });
});

test.describe("Shipper Auth - Authenticated", () => {
  // Uses the saved storageState from auth.setup.ts (default from config)

  test("authenticated user can access shipper pages", async ({ page }) => {
    await page.goto("/shipper/dashboard");
    await expect(
      page.getByRole("heading", { name: /Welcome back/ })
    ).toBeVisible();
  });
});
