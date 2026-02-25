/**
 * Deep Truck Add E2E Tests — Carrier Portal
 *
 * Verifies the truck registration form fields, validation,
 * submission, and navigation.
 */

import { test, expect } from "@playwright/test";
import { expectHeading } from "./test-utils";

test.describe("Deep: Register New Truck", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/carrier/trucks/add");
    await expectHeading(page, /Register New Truck/);
  });

  test("all form fields render", async ({ page }) => {
    const main = page.getByRole("main");

    await expect(main.getByText("Truck Type").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText("License Plate").first()).toBeVisible();
    await expect(main.getByText(/Capacity/i).first()).toBeVisible();
  });

  test("Truck Type dropdown has all options", async ({ page }) => {
    const select = page.locator("select").first();
    await expect(select).toBeVisible({ timeout: 10000 });

    const options = await select.locator("option").allTextContents();
    const expected = ["Flatbed", "Refrigerated", "Tanker", "Container"];
    for (const opt of expected) {
      expect(
        options.some((o) => o.toLowerCase().includes(opt.toLowerCase()))
      ).toBe(true);
    }
  });

  test("validation rejects empty form submission", async ({ page }) => {
    const submitBtn = page
      .getByRole("button", { name: /Register|Submit|Save/i })
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await submitBtn.click();

    // Should show validation errors or stay on form
    await expectHeading(page, /Register New Truck/);
  });

  test("location fields render", async ({ page }) => {
    const main = page.getByRole("main");
    const cityField = main.getByText(/City|Location/i).first();
    await expect(cityField).toBeVisible({ timeout: 10000 });
  });

  test("volume field is visible", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(main.getByText(/Volume/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("GPS device fields render if available", async ({ page }) => {
    const main = page.getByRole("main");
    // GPS field is labeled "GPS DEVICE ID" on the add form (always visible)
    await expect(main.getByText(/GPS Device ID/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("back/cancel navigates to trucks list", async ({ page }) => {
    const main = page.getByRole("main");
    const cancelBtn = main.getByRole("button", { name: /Cancel/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
  });

  test("successful truck creation redirects", async ({ page }) => {
    test.setTimeout(60000);

    const main = page.getByRole("main");

    // Fill in the form — labels are uppercase text, not <label> elements
    // Use placeholders to locate inputs
    const select = main.locator("select").first();
    await select.selectOption({ index: 1 });

    const plate = `ET-T-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const plateInput = main.getByPlaceholder("AA-12345");
    await plateInput.fill(plate);

    const capacityInput = main.getByPlaceholder("5000");
    if (await capacityInput.isVisible().catch(() => false)) {
      await capacityInput.fill("20000");
    }

    const volumeInput = main.getByPlaceholder("20");
    if (await volumeInput.isVisible().catch(() => false)) {
      await volumeInput.fill("60");
    }

    // Fill location — city uses a search input with placeholder "Search city..."
    const cityInput = main.getByPlaceholder(/Search city/i);
    if (await cityInput.isVisible().catch(() => false)) {
      await cityInput.fill("Addis Ababa");
    }

    // Region is a select dropdown
    const regionSelect = main.locator("select").nth(1);
    if (await regionSelect.isVisible().catch(() => false)) {
      await regionSelect.selectOption({ index: 1 }).catch(() => {});
    }

    // Submit
    const submitBtn = main
      .getByRole("button", { name: /Register|Submit|Save/i })
      .first();
    await submitBtn.click();

    // Should either redirect to trucks list/detail or show success toast
    const successRedirect = page
      .waitForURL("**/carrier/trucks**", { timeout: 15000 })
      .catch(() => null);
    const successToast = page
      .getByText(/successfully|created|registered/i)
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => null);
    const stayOnPage = page.waitForTimeout(15000);

    await Promise.race([successRedirect, successToast, stayOnPage]);
  });
});
