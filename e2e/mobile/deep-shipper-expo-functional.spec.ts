/**
 * Deep Shipper Expo — FUNCTIONAL flows only
 *
 * Mirror of e2e/mobile/deep-carrier-expo-functional.spec.ts in the
 * mobile shipper direction. Every test verifies a UI click produces
 * a real backend side-effect, then queries the API to confirm.
 *
 * Real PostgreSQL on :3000, real Expo bundle on :8081, real Chromium.
 * Zero mocks. Token seeded into sessionStorage to bypass per-IP login
 * throttle. Blueprint v1.6 §3/§8/§14.
 */

import { test, expect, Page, APIRequestContext } from "@playwright/test";
import { getToken as getCachedShipperToken } from "../shipper/test-utils";

const EXPO_URL = "http://localhost:8081";
const NEXT_API = "http://localhost:3000";
const EMAIL = "shipper@test.com";

test.use({ storageState: { cookies: [], origins: [] } });

async function getApiToken() {
  return await getCachedShipperToken(EMAIL);
}

async function loginAsShipper(page: Page) {
  const token = await getApiToken();
  await page.addInitScript((t: string) => {
    try {
      sessionStorage.setItem("session_token", t);
    } catch {
      /* noop */
    }
  }, token);
  await page.goto(EXPO_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  for (let i = 0; i < 2; i++) {
    const skip = page.getByText(/^Skip$/i).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  }
}

async function apiGet(request: APIRequestContext, path: string) {
  const token = await getApiToken();
  const res = await request.get(`${NEXT_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status(), data: await res.json().catch(() => ({})) };
}

// ─── SXP3-1: Edit company description via mobile UI → DB updated ──────────
test.describe.serial("Mobile Shipper FUNCTIONAL: company profile edit", () => {
  test("SXP3-1 — edit company description via mobile UI → DB updated", async ({
    page,
    request,
  }) => {
    const me = await apiGet(request, "/api/auth/me");
    const orgId = me.data.user?.organizationId;
    test.skip(!orgId, "no org");
    const before = await apiGet(request, `/api/organizations/${orgId}`);
    const beforeDesc =
      before.data.organization?.description ?? before.data.description ?? "";
    console.log(`org description BEFORE: "${beforeDesc?.slice(0, 60)}"`);

    const newDesc = `SXP3-1 functional ${Date.now()}`;

    await loginAsShipper(page);
    await page.goto(`${EXPO_URL}/(shipper)/settings`);
    await page.waitForTimeout(3500);

    const descInput = page.getByPlaceholder(/Company description/i).first();
    await expect(descInput).toBeVisible({ timeout: 10000 });
    await descInput.fill(newDesc);

    // Use role=button so we hit the actual <button>, not the inner text span
    const saveBtn = page.getByRole("button", { name: /^Save$/i }).last();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
    await saveBtn.click();
    await page.waitForTimeout(3500);

    const after = await apiGet(request, `/api/organizations/${orgId}`);
    const afterDesc =
      after.data.organization?.description ?? after.data.description ?? "";
    console.log(`org description AFTER:  "${afterDesc?.slice(0, 60)}"`);
    expect(afterDesc).toBe(newDesc);

    const token = await getApiToken();
    await request
      .patch(`${NEXT_API}/api/organizations/${orgId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: { description: beforeDesc },
      })
      .catch(() => {});
  });
});

// ─── SXP3-2: Toggle notification preference via mobile UI → DB updated ───
test.describe
  .serial("Mobile Shipper FUNCTIONAL: notification preferences", () => {
  test("SXP3-2 — toggle a notification preference via mobile UI → DB updated", async ({
    page,
    request,
  }) => {
    const before = await apiGet(request, "/api/user/notification-preferences");
    const beforePrefs = before.data.preferences ?? before.data ?? {};
    console.log(
      `notification prefs BEFORE: ${Object.keys(beforePrefs).length} keys`
    );

    await loginAsShipper(page);
    await page.goto(`${EXPO_URL}/(shared)/notification-preferences`);
    await page.waitForTimeout(3500);

    const firstSwitch = page.getByRole("switch").first();
    if (!(await firstSwitch.isVisible().catch(() => false))) {
      const cb = page.getByRole("checkbox").first();
      if (!(await cb.isVisible().catch(() => false))) {
        test.skip(true, "no switch/checkbox visible on prefs screen");
        return;
      }
      await cb.click();
    } else {
      await firstSwitch.click();
    }
    await page.waitForTimeout(800);

    const saveBtn = page.getByText(/^(Save|Update|Apply)$/i).first();
    if (!(await saveBtn.isVisible().catch(() => false))) {
      test.skip(true, "no Save button — preferences may auto-save");
      return;
    }
    await saveBtn.click();
    await page.waitForTimeout(2500);

    const after = await apiGet(request, "/api/user/notification-preferences");
    const afterPrefs = after.data.preferences ?? after.data ?? {};
    console.log(
      `notification prefs AFTER:  ${Object.keys(afterPrefs).length} keys`
    );
    expect(JSON.stringify(beforePrefs)).not.toBe(JSON.stringify(afterPrefs));

    const token = await getApiToken();
    await request
      .post(`${NEXT_API}/api/user/notification-preferences`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: { preferences: beforePrefs },
      })
      .catch(() => {});
  });
});

// ─── SXP3-3: Submit Telebirr deposit via mobile UI → row with exact values ─
test.describe
  .serial("Mobile Shipper FUNCTIONAL: deposit submission deep", () => {
  test("SXP3-3 — submit Telebirr deposit → row with exact amount/method/reference", async ({
    page,
    request,
  }) => {
    const beforeList = await apiGet(
      request,
      "/api/wallet/deposit?status=PENDING&limit=50"
    );
    const beforeIds = new Set<string>(
      (beforeList.data.deposits ?? []).map((d: { id: string }) => d.id)
    );
    console.log(`pending deposits BEFORE: ${beforeIds.size}`);

    await loginAsShipper(page);
    await page.goto(`${EXPO_URL}/(shipper)/wallet`);
    await page.waitForTimeout(3500);

    let depositBtn = page.getByTestId("wallet-deposit-button");
    if ((await depositBtn.count()) === 0) {
      depositBtn = page.getByText(/^Deposit Funds$/i).first();
    }
    await expect(depositBtn).toBeVisible({ timeout: 10000 });
    await depositBtn.click();
    await page.waitForTimeout(1500);

    await page
      .getByText(/^Telebirr$/i)
      .first()
      .click();
    await page.waitForTimeout(300);

    const uniqueRef = `SXP3-3-${Date.now()}`;
    await page.getByPlaceholder(/e\.g\. 5000/).fill("8888");
    await page.getByPlaceholder(/CT123456789/).fill(uniqueRef);

    await page
      .getByText(/^Submit Request$/i)
      .first()
      .click();
    await page.waitForTimeout(3000);

    // Toast may have already faded; DB row is the source of truth.
    const afterList = await apiGet(
      request,
      "/api/wallet/deposit?status=PENDING&limit=50"
    );
    const afterDeposits: Array<{
      id: string;
      amount: number | string;
      paymentMethod: string;
      externalReference: string | null;
    }> = afterList.data.deposits ?? [];
    const newOnes = afterDeposits.filter((d) => !beforeIds.has(d.id));
    expect(newOnes.length).toBe(1);
    expect(Number(newOnes[0].amount)).toBe(8888);
    expect(newOnes[0].paymentMethod).toBe("TELEBIRR");
    expect(newOnes[0].externalReference).toBe(uniqueRef);
  });
});
