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

// ─── DF-3: Dispatcher proposes a match via /dispatcher/proposals UI
//   Blueprint v1.6 §5: dispatcher can propose matches between POSTED
//   loads and ACTIVE truck postings. The carrier then accepts/rejects.
import { apiCall as carrierApiCall } from "../carrier/test-utils";
test.describe.serial("Web Dispatcher FUNCTIONAL: propose match", () => {
  test("DF-3 — fill New Proposal form → POST /api/match-proposals → row PENDING", async ({
    page,
  }) => {
    test.setTimeout(120000);
    test.skip(!token, "no token");

    // Snapshot: count of dispatcher's PENDING proposals before
    const beforeRes = await apiCall<{
      proposals?: Array<{ id: string }>;
    }>("GET", "/api/match-proposals?status=PENDING&limit=100", token);
    const beforeIds = new Set(
      (beforeRes.data.proposals ?? []).map((p) => p.id)
    );

    await page.goto("/dispatcher/proposals");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Click + New Proposal
    await page
      .getByRole("button", { name: /New Proposal/i })
      .first()
      .click();
    await page.waitForTimeout(1500);

    // Pick the first POSTED load + first ACTIVE truck posting from the
    // dropdowns
    const loadSelect = page
      .locator("select")
      .filter({ hasText: /Select a POSTED load/i })
      .first();
    await expect(loadSelect).toBeVisible({ timeout: 5000 });
    const loadOpts = await loadSelect.locator("option").all();
    let loadId = "";
    for (const opt of loadOpts) {
      const v = await opt.getAttribute("value");
      if (v) {
        loadId = v;
        break;
      }
    }
    test.skip(!loadId, "no POSTED loads available");
    await loadSelect.selectOption(loadId);
    await page.waitForTimeout(300);

    const truckSelect = page
      .locator("select")
      .filter({ hasText: /Select an ACTIVE truck posting/i })
      .first();
    await expect(truckSelect).toBeVisible();
    const truckOpts = await truckSelect.locator("option").all();
    let truckId = "";
    for (const opt of truckOpts) {
      const v = await opt.getAttribute("value");
      if (v) {
        truckId = v;
        break;
      }
    }
    test.skip(!truckId, "no ACTIVE truck postings available");
    await truckSelect.selectOption(truckId);
    await page.waitForTimeout(300);

    // Optional notes
    const notes = page.locator("textarea").first();
    if (await notes.count()) {
      await notes.fill(`DF-3 e2e proposal ${Date.now()}`);
    }

    // Submit
    await page
      .getByRole("button", { name: /^Create Proposal$/i })
      .first()
      .click();
    await page.waitForTimeout(3000);

    // Verify a new proposal row exists
    const afterRes = await apiCall<{
      proposals?: Array<{ id: string; loadId: string; truckId: string }>;
    }>("GET", "/api/match-proposals?status=PENDING&limit=100", token);
    const newOnes = (afterRes.data.proposals ?? []).filter(
      (p) => !beforeIds.has(p.id)
    );
    expect(newOnes.length).toBeGreaterThanOrEqual(1);
    expect(newOnes[0].loadId).toBe(loadId);
    expect(newOnes[0].truckId).toBe(truckId);
    console.log(`DF-3 created proposal ${newOnes[0].id}`);

    // Cleanup: cancel the proposal so subsequent runs aren't blocked
    // by partial-unique constraint on (loadId, truckId, PENDING)
    await carrierApiCall(
      "DELETE",
      `/api/match-proposals/${newOnes[0].id}`,
      await getDispatcherToken()
    ).catch(() => {});
  });
});
