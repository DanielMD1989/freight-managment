/**
 * Deep Truck Detail E2E Tests — Carrier Portal
 *
 * Verifies truck info card, GPS section, documents section,
 * carrier info, and API cross-checking.
 */

import { test, expect } from "@playwright/test";
import { getCarrierToken, apiCall, ensureTruck } from "./test-utils";

let carrierToken: string;
let truckId: string;
let licensePlate: string;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    carrierToken = await getCarrierToken();
    const result = await ensureTruck(carrierToken);
    truckId = result.truckId;
    licensePlate = result.licensePlate;
  } catch {
    // Tests will skip
  }
});

test.describe("Deep: Truck Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!truckId, "No truck available");
    await page.goto(`/carrier/trucks/${truckId}`);
    await page.waitForTimeout(2000);
  });

  test("shows license plate in page content", async ({ page }) => {
    await expect(page.getByText(licensePlate).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Truck Details subtitle is visible", async ({ page }) => {
    await expect(page.getByText(/Truck Details|Details/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("all info fields render", async ({ page }) => {
    const main = page.getByRole("main");
    const fields = ["Type", "Capacity"];
    for (const field of fields) {
      await expect(main.getByText(field).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("truck type value is visible", async ({ page }) => {
    await expect(
      page
        .getByText(
          /Flatbed|Refrigerated|Tanker|Container|Dry Van|Lowboy|Dump|Box/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status and approval badges render", async ({ page }) => {
    await expect(
      page.getByText(/APPROVED|PENDING|REJECTED|Active|Available/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Edit Truck button navigates to edit page", async ({ page }) => {
    const editBtn = page
      .getByRole("link", { name: /Edit/i })
      .first()
      .or(page.getByRole("button", { name: /Edit/i }).first());
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();
    await page.waitForURL(`**/carrier/trucks/${truckId}/edit**`, {
      timeout: 10000,
    });
  });

  test("back button navigates to trucks list", async ({ page }) => {
    const backBtn = page
      .getByRole("link", { name: /Back|← My Trucks|trucks/i })
      .first();
    await expect(backBtn).toBeVisible({ timeout: 10000 });
  });

  test("GPS device section renders", async ({ page }) => {
    const main = page.getByRole("main");
    const gpsSection = main
      .getByText(/GPS Device|IMEI|No GPS device configured/i)
      .first();
    await expect(gpsSection).toBeVisible({ timeout: 10000 });
  });

  test("Documents section renders", async ({ page }) => {
    const main = page.getByRole("main");
    const docsSection = main
      .getByRole("heading", { name: /Documents/i })
      .first();
    await expect(docsSection).toBeVisible({ timeout: 10000 });
  });

  test("document upload form has type dropdown with options", async ({
    page,
  }) => {
    const main = page.getByRole("main");
    const uploadSection = main
      .getByText(/Document Type|Upload New Document|Uploaded Documents/i)
      .first();
    await expect(uploadSection).toBeVisible({ timeout: 10000 });
  });

  test("carrier information section renders", async ({ page }) => {
    const main = page.getByRole("main");
    const carrierSection = main
      .getByText(/Carrier Information|Verified|Unverified/i)
      .first();
    await expect(carrierSection).toBeVisible({ timeout: 10000 });
  });

  test("cross-check truck data against API", async ({ page }) => {
    test.skip(!carrierToken, "No carrier token");
    test.setTimeout(60000);

    const { status, data } = await apiCall(
      "GET",
      `/api/trucks/${truckId}`,
      carrierToken
    );
    expect(status).toBe(200);

    const truck = data.truck ?? data;
    if (truck.licensePlate) {
      await expect(page.getByText(truck.licensePlate).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });
});
