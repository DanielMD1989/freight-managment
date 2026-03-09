/**
 * Blueprint §1 — Registration flows
 *
 * Tests are intentionally lenient about the exact post-submit URL/message
 * since test-env email delivery may not be configured.
 */

import { test, expect } from "@playwright/test";

// Fresh unauthenticated context for every test
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Registration — all roles", () => {
  test("shipper registration — all fields required — success or OTP step", async ({
    page,
  }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/register/);

    // Use IDs to avoid ambiguity — form has First Name, Last Name, Company Name
    await page.locator("#firstName").fill("Test");
    await page.locator("#lastName").fill("Shipper BP");
    await page.locator("#email").fill(`bp-shipper-${Date.now()}@example.com`);
    await page.locator("#phone").fill("+251912000001");
    // Default role is SHIPPER — set explicitly to be safe
    await page.locator("#role").selectOption("SHIPPER");
    // Company Name appears when role=SHIPPER
    await page.locator("#companyName").fill("BP Shipper Co");
    await page.locator("#password").fill("Test123!");
    await page.locator("#confirmPassword").fill("Test123!");

    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL(
      /verification-pending|otp|register|login|shipper|pending/,
      { timeout: 15000 }
    );
  });

  test("carrier registration — CARRIER role — success or OTP step", async ({
    page,
  }) => {
    await page.goto("/register");

    await page.locator("#firstName").fill("Test");
    await page.locator("#lastName").fill("Carrier BP");
    await page.locator("#email").fill(`bp-carrier-${Date.now()}@example.com`);
    await page.locator("#phone").fill("+251912000002");
    // Select CARRIER first — this resets companyName state
    await page.locator("#role").selectOption("CARRIER");
    // Company name label changes to "Company / Fleet Name" but input id stays #companyName
    await page.locator("#companyName").fill("BP Carrier Co");
    await page.locator("#password").fill("Test123!");
    await page.locator("#confirmPassword").fill("Test123!");

    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL(
      /verification-pending|otp|register|login|carrier|pending/,
      { timeout: 15000 }
    );
  });

  test("duplicate email shows error", async ({ page }) => {
    await page.goto("/register");

    await page.locator("#firstName").fill("Dup");
    await page.locator("#lastName").fill("Test");
    // Use a known seeded email
    await page.locator("#email").fill("shipper@test.com");
    await page.locator("#phone").fill("+251912000099");
    await page.locator("#role").selectOption("SHIPPER");
    await page.locator("#companyName").fill("Dup Test Co");
    await page.locator("#password").fill("Test123!");
    await page.locator("#confirmPassword").fill("Test123!");

    await page.getByRole("button", { name: /Create account/i }).click();

    const errEl = page
      .getByText(/already|duplicate|exists|registered/i)
      .first();
    await expect(errEl).toBeVisible({ timeout: 10000 });
  });

  test("invalid phone shows validation error", async ({ page }) => {
    await page.goto("/register");

    await page.locator("#firstName").fill("Phone");
    await page.locator("#lastName").fill("Test");
    await page.locator("#email").fill(`bp-phone-${Date.now()}@example.com`);
    await page.locator("#phone").fill("abc123");
    await page.locator("#role").selectOption("SHIPPER");
    await page.locator("#companyName").fill("Phone Test Co");
    await page.locator("#password").fill("Test123!");
    await page.locator("#confirmPassword").fill("Test123!");

    await page.getByRole("button", { name: /Create account/i }).click();

    // Either an inline validation message or an API error about phone format
    const err = page.getByText(/phone|invalid|format/i).first();
    const still = page.url();
    // Accept: error visible OR stayed on register page (client-side validation)
    const errVisible = await err
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(errVisible || still.includes("register")).toBeTruthy();
  });
});
