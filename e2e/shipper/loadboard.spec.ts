import { test, expect } from "@playwright/test";

test.describe("Shipper Loadboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shipper/loadboard");
  });

  test("shows loadboard heading and description", async ({ page }) => {
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Loadboard" })
    ).toBeVisible();
    await expect(
      main.getByText("Post your loads or find available trucks")
    ).toBeVisible();
  });

  test("displays tab navigation for My Loads and Search Trucks", async ({
    page,
  }) => {
    const main = page.getByRole("main");
    await expect(main.getByText("My Loads").first()).toBeVisible();
    await expect(main.getByText("Search Trucks")).toBeVisible();
  });

  test("My Loads tab shows status filters and POST NEW LOAD button", async ({
    page,
  }) => {
    await expect(
      page.getByText("Posted", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /POST NEW LOAD/i })
    ).toBeVisible();
  });

  test("switching to Search Trucks tab shows search interface", async ({
    page,
  }) => {
    const main = page.getByRole("main");
    await main.getByText("Search Trucks").click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Truck Type").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("load listings show route information or empty state", async ({
    page,
  }) => {
    await page.waitForTimeout(2000);
    // Should show load data or loading/empty state
    const hasContent = page
      .getByText(
        /Addis Ababa|Djibouti|Mekelle|Dire Dawa|No Posted Loads|Loading/
      )
      .first();
    await expect(hasContent).toBeVisible({ timeout: 10000 });
  });
});
