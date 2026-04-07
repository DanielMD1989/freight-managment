/**
 * Deep Dispatcher Web — FUNCTIONAL flows only
 *
 * Per Blueprint v1.6 §5 dispatchers are READ-ONLY against the marketplace
 * (cannot create/cancel loads, accept proposals, etc.). The mutation
 * surface they OWN is: own profile + notification preferences.
 *
 * These two tests verify UI clicks produce real DB writes against the
 * live Postgres on :3000. Zero mocks.
 */

import { test, expect } from "@playwright/test";
import { apiCall, getDispatcherToken } from "./test-utils";

let token: string;

test.beforeAll(async () => {
  test.setTimeout(60000);
  try {
    token = await getDispatcherToken();
  } catch {
    /* tests will skip */
  }
});

// ─── DF-1: Edit profile firstName via /settings/profile → DB updated ─────
test.describe.serial("Web Dispatcher FUNCTIONAL: profile edit", () => {
  test("DF-1 — edit firstName via /settings/profile → DB updated", async ({
    page,
  }) => {
    test.skip(!token, "no token");
    const before = await apiCall("GET", "/api/auth/me", token);
    const beforeName =
      (before.data as { user?: { firstName?: string } }).user?.firstName ?? "";
    console.log(`firstName BEFORE: "${beforeName}"`);

    const newName = `DF1-${String(Date.now()).slice(-6)}`;

    await page.goto("/settings/profile");
    await page.waitForLoadState("networkidle");

    const editBtn = page.getByRole("button", { name: /Edit Profile/i }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(400);
    }

    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(newName);

    const saveBtn = page.getByRole("button", { name: /Save Changes/i }).first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await page.waitForTimeout(2500);

    const after = await apiCall("GET", "/api/auth/me", token);
    const afterName =
      (after.data as { user?: { firstName?: string } }).user?.firstName ?? "";
    console.log(`firstName AFTER:  "${afterName}"`);
    expect(afterName).toBe(newName);

    await apiCall("PATCH", "/api/user/profile", token, {
      firstName: beforeName,
    }).catch(() => {});
  });
});

// ─── DF-2: Toggle notification preference → DB updated ─────────────────
test.describe
  .serial("Web Dispatcher FUNCTIONAL: notification preferences", () => {
  test("DF-2 — toggle a notification preference via web UI → DB updated", async ({
    page,
  }) => {
    test.skip(!token, "no token");
    const before = await apiCall(
      "GET",
      "/api/user/notification-preferences",
      token
    );
    const beforePrefs =
      (before.data as { preferences?: Record<string, boolean> }).preferences ??
      {};
    console.log(`prefs BEFORE: ${JSON.stringify(beforePrefs).slice(0, 100)}`);

    await page.goto("/settings/notifications");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const firstToggleLabel = page.locator("label.relative.inline-flex").first();
    if (!(await firstToggleLabel.count())) {
      test.skip(true, "no toggle visible");
      return;
    }
    await firstToggleLabel.click();
    await page.waitForTimeout(500);

    const saveBtn = page.getByRole("button", { name: /Save Changes/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(2500);

    const after = await apiCall(
      "GET",
      "/api/user/notification-preferences",
      token
    );
    const afterPrefs =
      (after.data as { preferences?: Record<string, boolean> }).preferences ??
      {};
    console.log(`prefs AFTER:  ${JSON.stringify(afterPrefs).slice(0, 100)}`);
    expect(JSON.stringify(beforePrefs)).not.toBe(JSON.stringify(afterPrefs));

    await apiCall("POST", "/api/user/notification-preferences", token, {
      preferences: beforePrefs,
    }).catch(() => {});
  });
});
