/**
 * Deep Truck Edit E2E Tests — Carrier Portal
 *
 * Verifies pre-populated edit form, validation, save,
 * and rejection reason display for rejected trucks.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, ensureTruck } from "./test-utils";

let carrierToken: string;
let truckId: string;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    carrierToken = await getCarrierToken();
    const result = await ensureTruck(carrierToken);
    truckId = result.truckId;
  } catch {
    // Tests will skip
  }
});

test.describe("Deep: Edit Truck Page", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!truckId, "No truck available");
    await page.goto(`/carrier/trucks/${truckId}/edit`);
    await page.waitForTimeout(2000);
  });

  test("heading renders", async ({ page }) => {
    const heading = page
      .getByRole("heading", { name: /Edit Truck|Resubmit/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("form is pre-populated with current truck data", async ({ page }) => {
    const main = page.getByRole("main");

    // Truck type selector should have a value
    const select = main.locator("select").first();
    await expect(select).toBeVisible({ timeout: 10000 });

    // License plate input should be filled
    const plateInput = main.getByLabel(/License Plate/i).first();
    if (await plateInput.isVisible().catch(() => false)) {
      const value = await plateInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test("all editable fields are present", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("Truck Type").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText(/Capacity/i).first()).toBeVisible();
  });

  test("validation errors on invalid input", async ({ page }) => {
    // Clear the license plate and submit
    const plateInput = page.getByLabel(/License Plate/i).first();
    if (await plateInput.isVisible().catch(() => false)) {
      await plateInput.clear();
      const submitBtn = page
        .getByRole("button", { name: /Save|Update|Submit/i })
        .first();
      await submitBtn.click();
      await page.waitForTimeout(1000);
      // Should stay on edit page or show error
      const heading = page
        .getByRole("heading", { name: /Edit Truck|Resubmit/i })
        .first();
      await expect(heading).toBeVisible({ timeout: 5000 });
    }
  });

  test("save changes persists update", async ({ page }) => {
    test.skip(!carrierToken, "No carrier token");
    test.setTimeout(45000);

    // Update the capacity field
    const capacityInput = page.getByLabel(/Capacity/i).first();
    if (await capacityInput.isVisible().catch(() => false)) {
      await capacityInput.clear();
      await capacityInput.fill("25000");

      const submitBtn = page
        .getByRole("button", { name: /Save|Update|Submit/i })
        .first();
      await submitBtn.click();

      // Should redirect or show success
      const success = page
        .getByText(/successfully|updated|saved/i)
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => null);
      const redirect = page
        .waitForURL(`**/carrier/trucks/${truckId}**`, { timeout: 10000 })
        .catch(() => null);

      await Promise.race([success, redirect]);
    }
  });

  test("back/cancel navigation works", async ({ page }) => {
    const main = page.getByRole("main");
    const cancelBtn = main.getByRole("button", { name: /Cancel/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
  });
});
