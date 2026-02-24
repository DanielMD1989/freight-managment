/**
 * Deep Load Creation E2E Tests
 *
 * Exercises the 4-step load creation form end-to-end:
 * Step 1 (Route) → Step 2 (Cargo) → Step 3 (Options) → Step 4 (Review).
 * Tests validation, back navigation, and full submission.
 */

import { test, expect } from "@playwright/test";
import { expectHeading } from "./test-utils";

test.describe("Deep: Load Creation Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loads/create");
    await expectHeading(page, /Post New Load/);
  });

  test("Step 1 route form renders all required fields", async ({ page }) => {
    // Step indicator
    await expect(page.getByText("Route")).toBeVisible();
    await expect(page.getByText("Cargo")).toBeVisible();
    await expect(page.getByText("Options")).toBeVisible();
    await expect(page.getByText("Review")).toBeVisible();

    // Route fields
    await expect(page.getByText("From")).toBeVisible();
    await expect(page.getByText("To", { exact: true })).toBeVisible();
    await expect(page.getByText("Pickup Date")).toBeVisible();
    await expect(page.getByText("Delivery Date")).toBeVisible();

    // Buttons
    await expect(
      page.getByRole("button", { name: /Save Draft/ })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("validation errors shown when submitting Step 1 empty", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("Step 1 → Step 2 transition shows cargo fields", async ({ page }) => {
    test.setTimeout(45000);

    // Fill Step 1
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);

    await page
      .locator('input[type="date"]')
      .first()
      .fill(tomorrow.toISOString().split("T")[0]);
    await page
      .locator('input[type="date"]')
      .nth(1)
      .fill(fiveDays.toISOString().split("T")[0]);

    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 should show cargo fields
    await expect(page.locator('input[type="number"]').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("textarea").first()).toBeVisible();
  });

  test("Step 2 → Step 3 transition shows options", async ({ page }) => {
    test.setTimeout(45000);

    // Fill Step 1
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);
    await page
      .locator('input[type="date"]')
      .first()
      .fill(tomorrow.toISOString().split("T")[0]);
    await page
      .locator('input[type="date"]')
      .nth(1)
      .fill(fiveDays.toISOString().split("T")[0]);
    await page.getByRole("button", { name: "Continue" }).click();

    // Fill Step 2
    await page.locator('input[type="number"]').first().fill("5000");
    await page.locator("textarea").first().fill("Deep test cargo");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 should be visible (Options)
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("Step 3 → Step 4 shows review summary with Post Load button", async ({
    page,
  }) => {
    test.setTimeout(45000);

    // Fill Steps 1-3
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);
    await page
      .locator('input[type="date"]')
      .first()
      .fill(tomorrow.toISOString().split("T")[0]);
    await page
      .locator('input[type="date"]')
      .nth(1)
      .fill(fiveDays.toISOString().split("T")[0]);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.locator('input[type="number"]').first().fill("5000");
    await page.locator("textarea").first().fill("Deep test cargo");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — accept defaults
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4 — Review
    await expect(page.getByRole("button", { name: "Post Load" })).toBeVisible({
      timeout: 10000,
    });

    // Review should show route summary
    await expect(page.getByText("Addis Ababa").first()).toBeVisible();
    await expect(page.getByText("Dire Dawa").first()).toBeVisible();
  });

  test("back navigation returns to previous step", async ({ page }) => {
    test.setTimeout(45000);

    // Navigate to Step 2
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);
    await page
      .locator('input[type="date"]')
      .first()
      .fill(tomorrow.toISOString().split("T")[0]);
    await page
      .locator('input[type="date"]')
      .nth(1)
      .fill(fiveDays.toISOString().split("T")[0]);
    await page.getByRole("button", { name: "Continue" }).click();

    // Should be on Step 2 — click Back
    await expect(page.locator('input[type="number"]').first()).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: /Back|Previous/ }).click();

    // Should be back on Step 1
    await expect(page.getByText("From")).toBeVisible({ timeout: 5000 });
  });

  test("full form submission creates load with 201 and redirects", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // Step 1
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);
    await page
      .locator('input[type="date"]')
      .first()
      .fill(tomorrow.toISOString().split("T")[0]);
    await page
      .locator('input[type="date"]')
      .nth(1)
      .fill(fiveDays.toISOString().split("T")[0]);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2
    await page.locator('input[type="number"]').first().fill("8000");
    await page
      .locator("textarea")
      .first()
      .fill("E2E deep test cargo — full submission");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3 — accept defaults
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4 — submit
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/loads") &&
          resp.request().method() === "POST" &&
          !resp.url().includes("load-requests")
      ),
      page.getByRole("button", { name: "Post Load" }).click(),
    ]);

    expect(response.status()).toBe(201);
    const body = await response.json();
    const loadId = body.load?.id ?? body.id;
    expect(loadId).toBeTruthy();

    // Should redirect to load detail
    await page.waitForURL("**/shipper/loads/**", { timeout: 15000 });
  });
});
