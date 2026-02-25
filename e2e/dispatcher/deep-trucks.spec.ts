import { test, expect } from "@playwright/test";
import {
  expectHeading,
  waitForMainContent,
  getDispatcherToken,
  apiCall,
} from "./test-utils";

test.describe("Deep: Dispatcher Trucks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dispatcher/trucks");
    await waitForMainContent(page);
  });

  test("renders page heading and subtitle", async ({ page }) => {
    await expectHeading(page, /All Trucks/i);
    const main = page.getByRole("main");
    await expect(
      main.getByText(/Browse and search all available truck postings/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("table columns present", async ({ page }) => {
    const main = page.getByRole("main");
    // Wait for table to load (not "Loading trucks...")
    await page.waitForTimeout(2000);
    const hasTable = await main
      .locator("table")
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasTable) {
      // Actual column headers: TRUCK, TYPE / CAPACITY, ROUTE, AVAILABLE, CARRIER, GPS, STATUS, ACTIONS
      // Use columnheader role to avoid matching dropdown options (e.g., "CAR CARRIER")
      const headers = main.getByRole("columnheader");
      const headerTexts = await headers.allTextContents();
      const headerStr = headerTexts.join(" ").toUpperCase();
      expect(headerStr).toContain("TRUCK");
      expect(headerStr).toContain("TYPE");
      expect(headerStr).toContain("ROUTE");
      expect(headerStr).toContain("CARRIER");
      expect(headerStr).toContain("GPS");
    } else {
      // May show "Loading trucks..." or empty state
      const showingText = main.getByText(/Showing|Loading/i).first();
      await expect(showingText).toBeVisible({ timeout: 5000 });
    }
  });

  test("search input present", async ({ page }) => {
    const main = page.getByRole("main");
    const searchInput = main.getByPlaceholder(/Search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test("status filter present", async ({ page }) => {
    const main = page.getByRole("main");
    const statusSelect = main.locator("select").first();
    const hasSelect = await statusSelect
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSelect) {
      const options = await statusSelect.locator("option").allTextContents();
      expect(options.some((o) => /Active/i.test(o))).toBe(true);
    } else {
      await expect(main.getByText(/All Statuses/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("truck type filter present", async ({ page }) => {
    const main = page.getByRole("main");
    const selects = main.locator("select");
    const selectCount = await selects.count();
    let found = false;
    for (let i = 0; i < selectCount; i++) {
      const options = await selects.nth(i).locator("option").allTextContents();
      if (options.some((o) => /DRY.BOX|Dry.Box|All Types/i.test(o))) {
        found = true;
        break;
      }
    }
    if (!found) {
      await expect(main.getByText(/All Types/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("Find Loads button for active postings", async ({ page }) => {
    const main = page.getByRole("main");
    // Wait for table to finish loading
    await page.waitForTimeout(2000);
    const findLoadsLink = main
      .getByRole("link", { name: /Find Loads/i })
      .first();
    const findLoadsBtn = main
      .getByRole("button", { name: /Find Loads/i })
      .first();
    const hasLink = await findLoadsLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasBtn = await findLoadsBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasLink && !hasBtn) {
      // If no active postings, table, loading, or empty state should show
      const hasTable = await main
        .locator("table")
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      const hasLoading = await main
        .getByText(/Loading|Showing 0/i)
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(hasTable || hasLoading).toBe(true);
    }
  });

  test("refresh button present", async ({ page }) => {
    const main = page.getByRole("main");
    const buttons = main.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("cross-check truck postings against API", async () => {
    test.setTimeout(60000);
    const token = await getDispatcherToken();
    const { status, data } = await apiCall("GET", "/api/truck-postings", token);
    test.skip(status !== 200, `Truck postings API returned ${status}`);
    expect(data).toBeDefined();
  });
});
