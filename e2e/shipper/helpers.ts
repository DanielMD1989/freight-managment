import { Page } from "@playwright/test";

/**
 * Auth is handled by storageState in playwright config.
 * This helper is kept for any test that needs a fresh login
 * (e.g., the auth spec itself which tests the login flow).
 */
export async function loginAsShipper(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("shipper@test.com");
  await page.getByLabel("Password").fill("Test123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/shipper**", { timeout: 15000 });
}
