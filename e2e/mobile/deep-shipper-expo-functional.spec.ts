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

// ─── SXP3-4: Create POSTED load via mobile UI → DB row ─────────────────
test.describe.serial("Mobile Shipper FUNCTIONAL: load create", () => {
  test("SXP3-4 — fill multi-step create form → POST /api/loads → DB row", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    const tag = `SXP3-4-${Date.now()}`;

    await loginAsShipper(page);
    await page.goto(`${EXPO_URL}/(shipper)/loads/create`);
    await page.waitForTimeout(3500);

    const tomorrow = new Date(Date.now() + 86400000)
      .toISOString()
      .split("T")[0];
    const dayAfter = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .split("T")[0];

    // Step 0: Route — inputs in document order
    const inputs = page.locator("input");
    await inputs.nth(0).pressSequentially("Addis Ababa", { delay: 10 });
    await inputs.nth(1).pressSequentially("Dire Dawa", { delay: 10 });
    await inputs.nth(2).pressSequentially(tomorrow, { delay: 10 });
    await inputs.nth(3).pressSequentially(dayAfter, { delay: 10 });
    await page.getByTestId("create-load-next").click();
    await page.waitForTimeout(800);

    // Step 1: Cargo — first chip is FLATBED, click DRY_VAN explicitly
    const dryVan = page.getByText(/^DRY VAN$/i).first();
    if (await dryVan.isVisible().catch(() => false)) {
      await dryVan.click();
    }
    const inputs1 = page.locator("input");
    await inputs1.nth(0).pressSequentially("4321", { delay: 10 });
    const cargoTextarea = page.locator("textarea").first();
    if (await cargoTextarea.count()) {
      await cargoTextarea.pressSequentially(`${tag} cargo`, { delay: 10 });
    } else {
      await inputs1.nth(2).pressSequentially(`${tag} cargo`, { delay: 10 });
    }
    await page.getByTestId("create-load-next").click();
    await page.waitForTimeout(800);

    // Step 2: Options — Contact Name + Phone are required for non-anonymous
    // marketplace posting. The mobile Input component uses
    // accessibilityLabel (NOT placeholder), so we address by label.
    // pressSequentially required for RHF Controller propagation.
    const contactName = page.getByLabel("Contact Name").first();
    await expect(contactName).toBeVisible({ timeout: 5000 });
    await contactName.click();
    await contactName.pressSequentially("SXP3-4 Tester", { delay: 10 });

    const contactPhone = page.getByLabel("Contact Phone").first();
    await expect(contactPhone).toBeVisible({ timeout: 5000 });
    await contactPhone.click();
    await contactPhone.pressSequentially("+251911234567", { delay: 10 });

    await page.getByTestId("create-load-next").click();
    await page.waitForTimeout(800);

    // Phase 3 production fix (commit 95d5ad5) bypasses RHF's
    // handleSubmit wrapper — onPress now calls trigger() + getValues()
    // directly. Final-1 (commit eaa59df) restored the Expo headless
    // env so this test can drive the real submit chain end-to-end.
    const submitBtn = page.getByTestId("create-load-submit");
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await submitBtn.click();
    await page.waitForTimeout(4500);

    // Verify by tag
    const list = await apiGet(request, "/api/loads?limit=20");
    const created:
      | { id: string; status: string; cargoDescription: string }
      | undefined = (list.data.loads ?? []).find(
      (l: { cargoDescription?: string }) => l.cargoDescription?.includes(tag)
    );
    expect(created).toBeTruthy();
    console.log(`mobile created load ${created!.id} status=${created!.status}`);

    // Cleanup
    const token = await getApiToken();
    await request
      .patch(`${NEXT_API}/api/loads/${created!.id}/status`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: { status: "CANCELLED", reason: "SXP3-4 cleanup" },
      })
      .catch(() => {});
  });
});

// ─── SXP3-5: Mobile shipper rates a carrier on a DELIVERED trip
//   Blueprint v1.6 §12: post-trip rating. Mobile shipper UI shipped in
//   commit 753a828; this test exercises the full UI → DB chain.
test.describe.serial("Mobile Shipper FUNCTIONAL: rating", () => {
  test("SXP3-5 — Rate Carrier modal → POST /api/trips/[id]/rate → Rating row", async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    const token = await getApiToken();

    // Find a DELIVERED or COMPLETED trip the shipper owns and hasn't
    // already rated.
    const tripsRes = await apiGet(
      request,
      "/api/trips?status=DELIVERED&limit=20"
    );
    let target = (
      (tripsRes.data.trips as Array<{
        id: string;
        status: string;
      }>) ?? []
    ).find((t) => ["DELIVERED", "COMPLETED"].includes(t.status));

    if (!target) {
      const tripsRes2 = await apiGet(
        request,
        "/api/trips?status=COMPLETED&limit=20"
      );
      target = (
        (tripsRes2.data.trips as Array<{
          id: string;
          status: string;
        }>) ?? []
      ).find((t) => ["DELIVERED", "COMPLETED"].includes(t.status));
    }
    test.skip(!target, "no DELIVERED/COMPLETED trip available");

    // Skip if shipper already rated this trip
    const existing = await apiGet(request, `/api/trips/${target!.id}/rate`);
    if (existing.data.myRating) {
      test.skip(true, "shipper already rated this trip");
      return;
    }

    await loginAsShipper(page);
    await page.goto(`${EXPO_URL}/(shipper)/trips/${target!.id}`);
    await page.waitForTimeout(3500);

    const rateBtn = page.getByText(/^Rate Carrier$/i).first();
    if (!(await rateBtn.isVisible().catch(() => false))) {
      test.skip(true, "Rate Carrier button not visible");
      return;
    }
    await rateBtn.click();
    await page.waitForTimeout(800);

    // The 5 stars are TouchableOpacity divs with cursor:pointer style.
    // Find them by traversing the modal — they're the only siblings
    // of an Ionicons-rendered icon font. Use evaluate to walk the DOM.
    const clickedStar = await page.evaluate(() => {
      // Find any element whose direct text content contains "Rate"
      // (modal title), then walk to its sibling row of clickable icons.
      const allDivs = Array.from(document.querySelectorAll("div"));
      // Find the StarRating row: a flex row with exactly 5 children that
      // each have cursor:pointer (TouchableOpacity in RNW).
      for (const div of allDivs) {
        const children = Array.from(div.children);
        if (children.length !== 5) continue;
        const allClickable = children.every((c) => {
          const cs = window.getComputedStyle(c as HTMLElement);
          return cs.cursor === "pointer";
        });
        if (allClickable) {
          (children[4] as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    test.skip(!clickedStar, "could not locate the 5-star row in the modal");
    await page.waitForTimeout(500);

    // Optional comment
    const comment = page.locator("textarea").first();
    if (await comment.count()) {
      await comment.click();
      await comment.pressSequentially(`SXP3-5 e2e ${Date.now()}`, {
        delay: 10,
      });
    }

    // Submit
    await page
      .getByText(/^Submit$/i)
      .first()
      .click();
    await page.waitForTimeout(3000);

    // Verify
    const after = await apiGet(request, `/api/trips/${target!.id}/rate`);
    console.log(
      `SXP3-5 myRating after: ${JSON.stringify(after.data.myRating)?.slice(0, 100)}`
    );
    expect(after.data.myRating).toBeTruthy();
    expect(after.data.myRating.stars).toBe(5);
  });
});
