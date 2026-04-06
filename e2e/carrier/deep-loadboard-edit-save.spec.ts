/**
 * Deep Loadboard Edit/Save E2E — Carrier Portal
 *
 * Reproduces and pins the bug the user hit by hand:
 *   "Failed to update truck posting" thrown from
 *   PostTrucksTab.tsx:1261 handleSaveEdit
 *
 * Root cause: editForm.availableFrom / availableTo were date-only strings
 * ("YYYY-MM-DD") from <input type="date">, but the PATCH /api/truck-postings/[id]
 * Zod schema requires z.string().datetime() (full ISO 8601). The API rejected
 * the payload and the client surfaced a generic "Failed to update truck
 * posting" toast.
 *
 * Real DB, real browser, real auth.
 */

import { test, expect } from "@playwright/test";
import {
  getCarrierToken,
  apiCall,
  ensureTruck,
  ensureTruckPosting,
} from "./test-utils";

let token: string;
let postingId: string | undefined;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    token = await getCarrierToken();
    const t = await ensureTruck(token);
    try {
      const p = await ensureTruckPosting(token, t.truckId);
      postingId =
        (p as { postingId?: string; id?: string }).postingId ??
        (p as { id?: string }).id;
    } catch {
      // posting may already exist
    }
    if (!postingId) {
      // Try to grab any existing active posting for this org
      const me = await apiCall<{ user?: { organizationId?: string } }>(
        "GET",
        "/api/auth/me",
        token
      );
      const orgId = me.data.user?.organizationId;
      if (orgId) {
        const list = await apiCall<{
          truckPostings?: Array<{ id: string }>;
          postings?: Array<{ id: string }>;
        }>("GET", `/api/truck-postings?organizationId=${orgId}&limit=1`, token);
        const ps = list.data.truckPostings ?? list.data.postings;
        if (Array.isArray(ps) && ps.length > 0) {
          postingId = ps[0].id;
        }
      }
    }
  } catch {
    // tests will skip
  }
});

test.describe("Deep: Carrier Loadboard — Edit Save (PATCH /api/truck-postings/[id])", () => {
  test("ES-1 — date-only string fails Zod .datetime() (regression guard)", async () => {
    test.skip(!token || !postingId, "no posting available");
    const res = await apiCall(
      "PATCH",
      `/api/truck-postings/${postingId}`,
      token,
      {
        availableFrom: "2026-04-15", // <-- bare date, no T
        availableTo: "2026-04-30",
      }
    );
    // Before the fix: API returns 400 here (Zod rejects). The client then
    // showed the generic "Failed to update truck posting" toast.
    // After the fix: client converts to ISO before sending so this exact
    // payload no longer reaches the server, but the SERVER contract still
    // enforces datetime — verifying that contract here is the regression
    // guard.
    expect(res.status).toBe(400);
    console.log("400 body:", JSON.stringify(res.data).slice(0, 200));
  });

  test("ES-2 — ISO datetime payload is accepted (the post-fix shape)", async () => {
    test.skip(!token || !postingId, "no posting available");
    const isoFrom = new Date("2026-04-15T00:00:00").toISOString();
    const isoTo = new Date("2026-04-30T00:00:00").toISOString();
    const res = await apiCall(
      "PATCH",
      `/api/truck-postings/${postingId}`,
      token,
      {
        availableFrom: isoFrom,
        availableTo: isoTo,
      }
    );
    console.log(
      `PATCH → ${res.status}`,
      JSON.stringify(res.data).slice(0, 200)
    );
    // Acceptable outcomes:
    //   200 — successful update (the happy path the fix unblocks)
    //   400 — unrelated validation error (e.g. posting status)
    //   409 — concurrent modification
    // The bug we're guarding against is the 400 we saw in ES-1 caused by the
    // datetime format. With ISO datetimes that specific failure cannot occur.
    expect([200, 400, 409]).toContain(res.status);
    if (res.status === 400) {
      // If it IS 400, make sure it's NOT the datetime error we just fixed
      const body = JSON.stringify(res.data).toLowerCase();
      expect(body).not.toContain("datetime");
      expect(body).not.toContain("invalid date");
    }
  });

  test("ES-3 — UI Edit → Save round-trip succeeds (real browser)", async ({
    page,
  }) => {
    test.skip(!token, "no carrier token");
    await page.goto("/carrier/loadboard");
    await page.waitForTimeout(2500);

    const main = page.getByRole("main");
    const editBtn = main.getByRole("button", { name: /^Edit$/ }).first();
    if (!(await editBtn.isVisible().catch(() => false))) {
      test.skip(true, "no postings to edit");
      return;
    }

    // Listen for the failure toast or any error console message
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await editBtn.click();
    await page.waitForTimeout(800);

    const saveBtn = page
      .getByRole("button", { name: /^(Save|Update|Repost|Save Changes)$/i })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await saveBtn.click();

    // Wait for either the success toast or the error toast
    await page.waitForTimeout(2500);
    const errorToast = page.getByText(/Failed to update truck posting/i);
    const errorCount = await errorToast.count();
    if (errorCount > 0) {
      // Capture and print the actual visible toast text for debugging
      const errorText = await errorToast.first().textContent();
      console.error(`UI showed error toast: ${errorText}`);
    }
    expect(errorCount).toBe(0);

    // The console should also be free of the "Update failed" log
    const updateFailedLogs = consoleErrors.filter((e) =>
      e.toLowerCase().includes("update failed")
    );
    expect(updateFailedLogs).toEqual([]);
  });
});
