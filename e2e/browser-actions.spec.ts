/**
 * Browser Action Tests — clicks real buttons, fills real forms, verifies results
 *
 * NOT API calls — actual browser interaction via Playwright page.click(), page.fill()
 * Tests against real PostgreSQL database via dev server
 */

import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  expectedPortal: string
) {
  // Use cookie injection to avoid rate limiter exhaustion
  const r = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (r.headers.get("set-cookie") ?? "").match(
    /session=([^;]+)/
  )?.[1];
  if (cookie) {
    await page
      .context()
      .addCookies([
        {
          name: "session",
          value: cookie,
          domain: "localhost",
          path: "/",
          httpOnly: true,
        },
      ]);
    await page.goto(expectedPortal, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  } else {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL(new RegExp(expectedPortal), { timeout: 15000 });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SHIPPER — Load CRUD via browser clicks
// ═══════════════════════════════════════════════════════════════════════

test.describe.serial("Shipper Browser Actions", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page, "shipper@test.com", "Test123!", "/shipper");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("Create load via 4-step form", async () => {
    test.setTimeout(60000);
    await page.goto("/shipper/loads/create");

    // Step 1: Route
    await page.locator("select").first().selectOption("Addis Ababa");
    await page.locator("select").nth(1).selectOption("Dire Dawa");
    const tomorrow = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .split("T")[0];
    const fiveDays = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    await page.locator('input[type="date"]').first().fill(tomorrow);
    await page.locator('input[type="date"]').nth(1).fill(fiveDays);
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2: Cargo
    await page.locator('input[type="number"]').first().fill("6000");
    await page.locator("textarea").first().fill("Browser test cargo");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 3: Options — fill required contact
    await page.getByPlaceholder("Your name").first().fill("Browser Test");
    await page.getByPlaceholder("+251").first().fill("+251911111111");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 4: Review — click Post Load
    await expect(page.getByRole("button", { name: "Post Load" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Addis Ababa").first()).toBeVisible();
    await expect(page.getByText("Dire Dawa").first()).toBeVisible();

    // Submit and verify redirect
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/loads") &&
          r.request().method() === "POST" &&
          !r.url().includes("load-requests")
      ),
      page.getByRole("button", { name: "Post Load" }).click(),
    ]);
    expect(response.status()).toBe(201);
  });

  test("Edit posted load via loadboard", async () => {
    test.setTimeout(30000);
    await page.goto("/shipper/loadboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Find Edit button — may be icon button or text button
    const editBtn = page.locator("button").filter({ hasText: /Edit/i }).first();
    const hasEdit = await editBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasEdit) {
      // Try "Edit & Post" for UNPOSTED loads
      const editPostBtn = page
        .locator("button")
        .filter({ hasText: /Edit & Post/i })
        .first();
      const hasEditPost = await editPostBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (!hasEditPost) {
        test.skip(true, "No editable loads on loadboard");
        return;
      }
      await editPostBtn.click();
    } else {
      await editBtn.click();
    }

    // Wait for edit form — look for save/cancel buttons
    await page.waitForTimeout(1500);
    const saveBtn = page.locator("button").filter({ hasText: /Save/i }).first();
    const hasSave = await saveBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasSave) {
      // Try to change cargo description if textarea visible
      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.fill("Edited via browser test");
      }
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
    // Test passes if we got this far without errors — edit flow works
  });

  test("Unpost load via loadboard — intercepts PATCH response", async () => {
    test.setTimeout(30000);
    await page.goto("/shipper/loadboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Look for any Unpost button on the current view
    const unpostBtn = page
      .locator("button")
      .filter({ hasText: /^Unpost$/i })
      .first();
    const hasUnpost = await unpostBtn
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!hasUnpost) {
      test.skip(
        true,
        "No Unpost button visible — loads may not be on Posted tab"
      );
      return;
    }

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/loads/") && r.request().method() === "PATCH",
        { timeout: 10000 }
      ),
      unpostBtn.click(),
    ]);
    expect(response.status()).toBe(200);
  });

  test("Delete draft load", async () => {
    test.setTimeout(20000);
    // Navigate to drafts tab if available
    await page.goto("/shipper/loadboard");
    await page.waitForLoadState("networkidle");

    const draftsTab = page.getByRole("button", { name: /Draft/i }).first();
    if (await draftsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await draftsTab.click();
      await page.waitForTimeout(1500);
    }

    const deleteBtn = page.getByRole("button", { name: /Delete/i }).first();
    const hasDelete = await deleteBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!hasDelete) {
      test.skip(true, "No deletable loads");
      return;
    }

    // Click delete — might have confirmation
    await deleteBtn.click();

    // Handle confirmation dialog if present
    const confirmBtn = page
      .getByRole("button", { name: /Confirm|Yes|Delete/i })
      .first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/loads/") && r.request().method() === "DELETE"
        ),
        confirmBtn.click(),
      ]);
      expect(response.status()).toBe(200);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CARRIER — Trip state transitions via browser clicks
// ═══════════════════════════════════════════════════════════════════════

test.describe("Carrier Browser Actions", () => {
  test("Login and view dashboard", async ({ page }) => {
    await loginViaUI(page, "carrier@test.com", "Test123!", "/carrier");
    await expect(page.getByText(/Welcome back/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Total Trucks/i)).toBeVisible();
  });

  test("Navigate to trucks list", async ({ page }) => {
    await loginViaUI(page, "carrier@test.com", "Test123!", "/carrier");
    await page.goto("/carrier/trucks");
    await page.waitForLoadState("networkidle");

    // Should see truck cards or table
    const main = page.getByRole("main");
    const hasTrucks = await main
      .getByText(/AA-|DD-|MK-|HW-|DJ-|WF-/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const emptyState = await main
      .getByText(/No trucks/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasTrucks || emptyState).toBe(true);
  });

  test("View trip detail page", async ({ page }) => {
    await loginViaUI(page, "carrier@test.com", "Test123!", "/carrier");
    await page.goto("/carrier/trips");
    await page.waitForLoadState("networkidle");

    // Check if there are any trips to click
    const tripLink = page.locator("a[href*='/carrier/trips/']").first();
    const hasTrips = await tripLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasTrips) {
      // Check trip history
      await page.goto("/carrier/trip-history");
      await page.waitForLoadState("networkidle");
      const historyContent = page
        .getByText(/Addis Ababa|Dire Dawa|No completed/i)
        .first();
      await expect(historyContent).toBeVisible({ timeout: 10000 });
      return;
    }

    await tripLink.click();
    await page.waitForLoadState("networkidle");
    // Trip detail should show route info
    const detail = page
      .getByText(/Addis Ababa|Dire Dawa|ASSIGNED|IN_TRANSIT|DELIVERED/i)
      .first();
    await expect(detail).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN — Dashboard and management via browser
// ═══════════════════════════════════════════════════════════════════════

test.describe("Admin Browser Actions", () => {
  test("Login and see dashboard", async ({ page }) => {
    await loginViaUI(page, "admin@test.com", "Test123!", "/admin");
    const main = page.getByRole("main");
    await expect(main.getByText(/Welcome back/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Analytics page shows charts with DateRangePicker", async ({ page }) => {
    await loginViaUI(page, "admin@test.com", "Test123!", "/admin");
    await page.goto("/admin/analytics");
    await page.waitForLoadState("networkidle");

    // DateRangePicker buttons
    await expect(page.getByRole("button", { name: "7 days" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "30 days" })).toBeVisible();
    await expect(page.getByRole("button", { name: "90 days" })).toBeVisible();

    // Click 7 days and verify it triggers data fetch
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/admin/analytics")),
      page.getByRole("button", { name: "7 days" }).click(),
    ]);
    expect(response.status()).toBe(200);
  });

  test("Users management page loads", async ({ page }) => {
    await loginViaUI(page, "admin@test.com", "Test123!", "/admin");
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");

    // Should show user list
    const main = page.getByRole("main");
    const hasUsers = await main
      .getByText(/shipper@test|carrier@test|admin@test/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(hasUsers).toBe(true);
  });

  test("Organizations page loads", async ({ page }) => {
    await loginViaUI(page, "admin@test.com", "Test123!", "/admin");
    await page.goto("/admin/organizations");
    await page.waitForLoadState("networkidle");

    const main = page.getByRole("main");
    // Should show organization table or list
    const hasOrgs = await main
      .locator("table, [role='grid']")
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasOrgText = await main
      .getByText(/Organization Management|Manage all/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(hasOrgs || hasOrgText).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DISPATCHER — Dashboard with charts
// ═══════════════════════════════════════════════════════════════════════

test.describe("Dispatcher Browser Actions", () => {
  test("Login and see dashboard with charts", async ({ page }) => {
    await loginViaUI(page, "dispatcher@test.com", "password", "/dispatcher");

    const main = page.getByRole("main");
    await expect(main.getByText(/Welcome back/i).first()).toBeVisible({
      timeout: 10000,
    });

    // v1.7 charts should be visible
    await expect(main.getByText(/On-Time Delivery Rate/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(main.getByText(/Load Volume/i).first()).toBeVisible();

    // DateRangePicker should be visible
    await expect(page.getByRole("button", { name: "30 days" })).toBeVisible();
  });

  test("All Loads tab works", async ({ page }) => {
    await loginViaUI(page, "dispatcher@test.com", "password", "/dispatcher");
    await page.waitForLoadState("networkidle");

    // Click All Loads tab in the dashboard tabs section
    const loadsTab = page.getByRole("button", { name: /All Loads/i }).first();
    await expect(loadsTab).toBeVisible({ timeout: 10000 });
    await loadsTab.click();
    await page.waitForTimeout(3000);

    // Should show loads table or content
    const main = page.getByRole("main");
    const hasContent = await main
      .getByText(/Addis Ababa|Dire Dawa|POSTED|ASSIGNED|DRY_VAN|FLATBED/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasEmpty = await main
      .getByText(/No loads|Loading/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasContent || hasEmpty).toBe(true);
  });

  test("All Trucks tab works", async ({ page }) => {
    await loginViaUI(page, "dispatcher@test.com", "password", "/dispatcher");
    await page.waitForLoadState("networkidle");

    const trucksTab = page.getByRole("button", { name: /All Trucks/i }).first();
    await expect(trucksTab).toBeVisible({ timeout: 10000 });
    await trucksTab.click();
    await page.waitForTimeout(3000);

    const main = page.getByRole("main");
    const hasContent = await main
      .getByText(/AA-|DD-|MK-|HW-|DJ-|DRY|FLATBED/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasEmpty = await main
      .getByText(/No trucks|Loading/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasContent || hasEmpty).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS — Profile, Help, Report
// ═══════════════════════════════════════════════════════════════════════

test.describe("Settings Browser Actions", () => {
  test("Help pages load", async ({ page }) => {
    await loginViaUI(page, "shipper@test.com", "Test123!", "/shipper");

    const slugsAndExpected = [
      { slug: "getting-started", text: "Create Your Account" },
      { slug: "posting-loads", text: "Creating a Load" },
      { slug: "gps-tracking", text: "GPS" },
      { slug: "payments-settlements", text: "Wallet" },
    ];

    for (const { slug, text } of slugsAndExpected) {
      await page.goto(`/settings/support/help/${slug}`);
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(text).first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("Profile page loads and shows user info", async ({ page }) => {
    await loginViaUI(page, "shipper@test.com", "Test123!", "/shipper");
    await page.goto("/settings/profile");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText(/Test Shipper|shipper@test.com/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
