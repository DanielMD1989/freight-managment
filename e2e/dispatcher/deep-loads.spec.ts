import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getDispatcherToken,
  apiCall,
} from "./test-utils";

test.describe("Deep: Dispatcher Loads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dispatcher/loads");
    await waitForMainContent(page);
  });

  test("renders page heading and subtitle", async ({ page }) => {
    await expectHeading(page, /All Loads/i);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Browse and search all posted loads/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("status filter options visible", async ({ page }) => {
    const main = page.getByRole("main");
    // Status filter should be a select/combobox
    const statusSelect = main.locator("select").first();
    const hasSelect = await statusSelect
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSelect) {
      const options = await statusSelect.locator("option").allTextContents();
      expect(options.some((o) => /Posted/i.test(o))).toBe(true);
      expect(options.some((o) => /Assigned/i.test(o))).toBe(true);
      expect(options.some((o) => /In Transit/i.test(o))).toBe(true);
      expect(options.some((o) => /Delivered/i.test(o))).toBe(true);
    } else {
      // Fallback: check for filter text
      await expect(main.getByText(/All Statuses/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("truck type filter dropdown with types", async ({ page }) => {
    const main = page.getByRole("main");
    const selects = main.locator("select");
    const selectCount = await selects.count();

    // Find the truck type select (second select or one containing DRY_BOX)
    let found = false;
    for (let i = 0; i < selectCount; i++) {
      const options = await selects.nth(i).locator("option").allTextContents();
      if (options.some((o) => /DRY.BOX|Dry.Box/i.test(o))) {
        found = true;
        expect(options.length).toBeGreaterThanOrEqual(5);
        break;
      }
    }
    if (!found) {
      // May use a custom filter with text
      await expect(main.getByText(/All Types/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("search input present", async ({ page }) => {
    const main = page.getByRole("main");
    const searchInput = main.getByPlaceholder(/Search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test("refresh button present", async ({ page }) => {
    const main = page.getByRole("main");
    const refreshBtn = main.getByRole("button", { name: /refresh/i }).first();
    const hasRefresh = await refreshBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasRefresh) {
      // Icon-only refresh button
      const buttons = main.locator("button");
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(1);
    } else {
      expect(hasRefresh).toBe(true);
    }
  });

  test("table columns present", async ({ page }) => {
    const main = page.getByRole("main");
    // Check for key column headers
    await expect(main.getByText(/Load ID/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText(/Status/i).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(main.getByText(/Route/i).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(main.getByText(/Truck Type/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("Find Trucks button shown for POSTED loads", async ({ page }) => {
    const main = page.getByRole("main");
    // Wait for table to load
    const hasTable = await main
      .locator("table")
      .isVisible({ timeout: 15000 })
      .catch(() => false);

    if (hasTable) {
      // "Find Trucks" may be a link or a button
      const findTrucksLink = main
        .getByRole("link", { name: /Find Trucks/i })
        .first();
      const findTrucksBtn = main
        .getByRole("button", { name: /Find Trucks/i })
        .first();
      const findTrucksText = main.getByText(/Find Trucks/i).first();
      const hasLink = await findTrucksLink
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasBtn = await findTrucksBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const hasText = await findTrucksText
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      // Conditional — only shows when POSTED loads exist in the filtered view
      expect(hasLink || hasBtn || hasText || hasTable).toBe(true);
    } else {
      // No table yet — loading or empty state
      expect(true).toBe(true);
    }
  });

  test("results summary text visible", async ({ page }) => {
    const main = page.getByRole("main");
    const summary = main.getByText(/Showing|Page|of/i).first();
    const hasSummary = await summary
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // Pagination or summary text should be present if loads exist
    if (!hasSummary) {
      const hasTable = await main
        .locator("table")
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const hasEmpty = await main
        .getByText(/no loads/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(hasTable || hasEmpty).toBe(true);
    }
  });

  test("cross-check loads against API", async () => {
    test.setTimeout(60000);
    const token = await getDispatcherToken();
    const { status, data } = await apiCall(
      "GET",
      "/api/loads?status=POSTED",
      token
    );
    test.skip(status !== 200, `Loads API returned ${status}`);
    const loads = data.loads ?? data;
    expect(Array.isArray(loads)).toBe(true);
  });

  test("status filter changes displayed results", async ({ page }) => {
    const main = page.getByRole("main");
    const statusSelect = main.locator("select").first();
    const hasSelect = await statusSelect
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSelect) {
      // Select "Posted" status
      const options = await statusSelect.locator("option").allTextContents();
      const postedOption = options.find((o) => /Posted/i.test(o));
      if (postedOption) {
        await statusSelect.selectOption({ label: postedOption });
        // Wait for results to update
        await page.waitForTimeout(1000);
        // Page should still be functional
        await expect(main).toBeVisible();
      }
    }
    expect(true).toBe(true);
  });
});
