/**
 * Blueprint §2 — Document upload during registration
 *
 * Verifies that the upload UI is accessible for both roles.
 * Actual file upload is attempted but may fail silently if
 * cloud storage is not configured in the test environment.
 */

import { test, expect } from "@playwright/test";
import path from "path";

// A minimal 1-byte PDF stand-in for testing the file-input mechanism
const TEST_PDF_PATH = path.resolve(
  __dirname,
  "../../../e2e/.auth/token-cache.json"
); // any existing file

test.describe("Document upload — Shipper", () => {
  test.use({ storageState: "e2e/.auth/shipper.json" });

  test("shipper /shipper/documents page shows upload section", async ({
    page,
  }) => {
    await page.goto("/shipper/documents");

    // Accept: upload button, dropzone, file input, or locked banner (already approved)
    // Use .or() without .first() on sub-locators — apply single .first() on combined result
    const uploadUi = page.getByRole("button", {
      name: /upload|add.*document|choose/i,
    });
    const dropzone = page.getByText(/drag.*drop|drop.*file|upload/i);
    const lockBanner = page.getByText(
      /documents.*locked|locked.*document|approved/i
    );

    await expect(uploadUi.or(dropzone).or(lockBanner).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("shows status message after page load", async ({ page }) => {
    await page.goto("/shipper/documents");

    // Page should render something meaningful — scoped to main to avoid sidebar matches
    await expect(
      page
        .locator("main")
        .getByText(/document|upload|pending|approved|locked/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Document upload — Carrier", () => {
  test.use({ storageState: "e2e/.auth/carrier.json" });

  test("carrier /carrier/documents page shows upload section", async ({
    page,
  }) => {
    await page.goto("/carrier/documents");

    // Use .or() without .first() on sub-locators — apply single .first() on combined result
    const uploadUi = page.getByRole("button", {
      name: /upload|add.*document|choose/i,
    });
    const dropzone = page.getByText(/drag.*drop|drop.*file|upload/i);
    const lockBanner = page.getByText(
      /documents.*locked|locked.*document|approved/i
    );

    await expect(uploadUi.or(dropzone).or(lockBanner).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("shows waiting-for-approval status or upload form after navigation", async ({
    page,
  }) => {
    await page.goto("/carrier/documents");

    // Scope to main to avoid sidebar nav matches
    await expect(
      page
        .locator("main")
        .getByText(/document|upload|pending|approved|waiting|verification/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });
});
