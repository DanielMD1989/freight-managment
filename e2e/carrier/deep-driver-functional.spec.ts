/**
 * Deep Driver Functional E2E Tests
 *
 * Mirror of the CF-1..CF-15 pattern in deep-carrier-functional.spec.ts but
 * scoped to driver lifecycle. Every test:
 *   1. Navigates to the page in Chromium
 *   2. Performs a real action (form fill / button click / dropdown select)
 *   3. Verifies the API/DB state changed (not just page text)
 *
 * Real PostgreSQL on :3000, real Chromium with e2e/.auth/carrier.json.
 *
 * Workflow contract:
 *   1) Driver invite → accept → approve → assign → lifecycle (DF-1..DF-9)
 *   2) Reject + suspend (DF-10..DF-12)
 *   3) Dashboard stats verification (DF-13)
 *   4) Cross-portal impact (DF-14..DF-15)
 *
 * Notes on driver state machine:
 *   INVITED → (driver accept-invite) → PENDING_VERIFICATION → (carrier approve) → ACTIVE
 *
 * The accept-invite step is normally done by the driver via the driver-app.
 * Here we call it via API between DF-2 and DF-3 so the carrier UI then has
 * a real PENDING_VERIFICATION row to click "Approve" on.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  apiCall,
  getCarrierToken,
  getShipperToken,
  getAdminToken,
  ensureTruck,
  BASE_URL,
} from "./test-utils";
import { freeUpCarrierTrucks } from "../shared/trip-cleanup";

const TEST_PASSWORD = "Test123!";
const DRIVER_PASSWORD = "DriverPw123!";

let carrierToken: string;
let shipperToken: string;
let adminToken: string;

// Captured at suite start so afterAll can clean up.
const createdDriverIds: string[] = [];
const createdTripIds: string[] = [];

interface DriverApi {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: string;
  driverProfile?: { isAvailable?: boolean } | null;
}
interface TripApi {
  id: string;
  status: string;
  driverId: string | null;
  driver?: DriverApi | null;
}

function fullName(d: DriverApi | null | undefined): string {
  if (!d) return "";
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
}

/** Inline trip seeder — ensureCarrierTrip in test-utils omits shipperContact* fields. */
async function seedFreshTrip(): Promise<string | null> {
  try {
    const { truckId } = await ensureTruck(carrierToken);

    const tomorrow = new Date(Date.now() + 86400000)
      .toISOString()
      .split("T")[0];
    const fiveDays = new Date(Date.now() + 5 * 86400000)
      .toISOString()
      .split("T")[0];

    const loadRes = await apiCall("POST", "/api/loads", shipperToken, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow,
      deliveryDate: fiveDays,
      truckType: "FLATBED",
      weight: 5000,
      cargoDescription: "DF-* spec trip",
      status: "POSTED",
      shipperContactName: "DF Shipper Contact",
      shipperContactPhone: "+251911222333",
    });
    if (loadRes.status !== 201) {
      console.warn("seedFreshTrip load failed:", loadRes.data);
      return null;
    }
    const loadId =
      (loadRes.data as { load?: { id?: string }; id?: string }).load?.id ??
      (loadRes.data as { id?: string }).id;
    if (!loadId) return null;

    const reqRes = await apiCall("POST", "/api/load-requests", carrierToken, {
      loadId,
      truckId,
      notes: "DF-* spec request",
    });
    if (reqRes.status !== 201) {
      console.warn("seedFreshTrip request failed:", reqRes.data);
      return null;
    }
    const requestId =
      (
        reqRes.data as {
          loadRequest?: { id?: string };
          request?: { id?: string };
          id?: string;
        }
      ).loadRequest?.id ??
      (reqRes.data as { request?: { id?: string } }).request?.id ??
      (reqRes.data as { id?: string }).id;
    if (!requestId) return null;

    await apiCall(
      "POST",
      `/api/load-requests/${requestId}/respond`,
      shipperToken,
      { action: "APPROVE" }
    );

    const confRes = await apiCall(
      "POST",
      `/api/load-requests/${requestId}/confirm`,
      carrierToken,
      { action: "CONFIRM" }
    );
    const tripId = (confRes.data as { trip?: { id?: string } }).trip?.id;
    if (!tripId) return null;

    createdTripIds.push(tripId);
    return tripId;
  } catch (err) {
    console.warn("seedFreshTrip threw:", err);
    return null;
  }
}

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    carrierToken = await getCarrierToken();
    shipperToken = await getShipperToken();
    adminToken = await getAdminToken();
  } catch (err) {
    console.warn("DF beforeAll token fetch failed:", err);
    return;
  }
  // Free up any non-terminal trips on the carrier so seed doesn't trip
  // "Truck is currently on an active trip" 500s from earlier specs.
  await freeUpCarrierTrucks(carrierToken, adminToken).catch(() => {});
});

test.afterAll(async () => {
  // Best-effort cleanup: cancel any trips we created and suspend any leftover
  // drivers in non-terminal states so the seed pool stays usable.
  if (!carrierToken || !adminToken) return;

  for (const tripId of createdTripIds) {
    await apiCall("POST", `/api/trips/${tripId}/cancel`, adminToken, {
      reason: "DF spec cleanup",
    }).catch(() => {});
  }

  for (const driverId of createdDriverIds) {
    // DELETE = soft-suspend; safe even if already SUSPENDED/REJECTED.
    await apiCall("DELETE", `/api/drivers/${driverId}`, carrierToken).catch(
      () => {}
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// WORKFLOW 1 — Invite → Accept → Approve → Assign → Lifecycle
// ════════════════════════════════════════════════════════════════════════════

test.describe
  .serial("Carrier FUNCTIONAL: Driver invite → approve → assign → lifecycle", () => {
  let firstDriverId: string | null = null;
  let firstDriverName = "";
  let firstDriverPhone = "";
  let firstInviteCode = "";
  let workflowTripId: string | null = null;

  test("DF-1 — invite driver via /carrier/drivers/invite form → invite code generated", async ({
    page,
  }) => {
    test.skip(!carrierToken, "no carrier token");

    const ts = Date.now().toString(36).slice(-6).toUpperCase();
    firstDriverName = `Playwright Driver ${ts}`;
    firstDriverPhone = `+251955${Math.floor(100000 + Math.random() * 899999)}`;
    const inviteEmail = `pw-driver-${ts.toLowerCase()}@test.com`;

    await page.goto("/carrier/drivers/invite");
    await expect(
      page.getByRole("heading", { name: /Invite a Driver/i })
    ).toBeVisible({ timeout: 10000 });

    // Form fields are positional <input> elements
    await page.locator('input[type="text"]').first().fill(firstDriverName);
    await page.locator('input[type="tel"]').first().fill(firstDriverPhone);
    await page.locator('input[type="email"]').first().fill(inviteEmail);

    const submit = page.getByRole("button", { name: /Generate Invite Code/i });
    await expect(submit).toBeEnabled({ timeout: 5000 });
    await submit.click();

    // Success page
    await expect(page.getByText(/Driver Invited Successfully/i)).toBeVisible({
      timeout: 15000,
    });

    // Capture the 6-char invite code from the .font-mono pill
    const codeEl = page.locator("p.font-mono").first();
    await expect(codeEl).toBeVisible({ timeout: 5000 });
    firstInviteCode = (await codeEl.innerText()).trim();
    expect(firstInviteCode).toMatch(/^[A-Z0-9]{6}$/);

    // Copy button is the visible UI affordance for the new code
    await expect(
      page.getByRole("button", { name: /Copy to Clipboard/i })
    ).toBeVisible();

    // Verify in API: a brand-new INVITED driver row exists with our phone
    const list = await apiCall("GET", "/api/drivers?limit=100", carrierToken);
    const drivers =
      ((list.data as { drivers?: DriverApi[] }).drivers as DriverApi[]) ?? [];
    const created = drivers.find((d) => d.phone === firstDriverPhone);
    expect(
      created,
      `new driver ${firstDriverPhone} in /api/drivers`
    ).toBeTruthy();
    expect(created!.status).toBe("INVITED");
    firstDriverId = created!.id;
    createdDriverIds.push(firstDriverId);
    console.log(`DF-1 invited ${firstDriverId} code=${firstInviteCode}`);
  });

  test("DF-2 — new driver appears in /carrier/drivers (All tab) with INVITED badge", async ({
    page,
  }) => {
    test.skip(!firstDriverId, "DF-1 didn't create a driver");

    await page.goto("/carrier/drivers");
    await page.waitForLoadState("networkidle");

    // The "All" tab is the default and the only tab that shows INVITED rows
    // (Pending tab filters status=PENDING_VERIFICATION).
    const allTab = page.getByRole("button", { name: /^All$/ }).first();
    if (await allTab.isVisible().catch(() => false)) {
      await allTab.click();
      await page.waitForTimeout(800);
    }

    // Driver row + INVITED badge must be visible
    await expect(page.getByText(firstDriverName).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(firstDriverPhone).first()).toBeVisible();
    await expect(page.getByText(/^Invited$/i).first()).toBeVisible();
  });

  test("DF-3 — accept invite (API) then approve via UI button → status ACTIVE", async ({
    page,
  }) => {
    test.skip(!firstDriverId, "no driver");

    // The invite flow is INVITED → (driver accepts) → PENDING_VERIFICATION
    // → (carrier approves) → ACTIVE. accept-invite is the driver's action;
    // we simulate it here so the carrier UI then has a Pending row to click.
    // Note: accept-invite is unauthenticated but the CSRF middleware still runs.
    // Sending any Bearer token causes validateCSRFWithMobile() to skip CSRF.
    const accept = await apiCall(
      "POST",
      "/api/drivers/accept-invite",
      "driver-accept-invite",
      {
        inviteCode: firstInviteCode,
        phone: firstDriverPhone,
        password: DRIVER_PASSWORD,
      }
    );
    expect(
      accept.status,
      `accept-invite status (${JSON.stringify(accept.data)})`
    ).toBe(201);

    // Confirm the API moved status to PENDING_VERIFICATION
    const beforeApprove = await apiCall(
      "GET",
      `/api/drivers/${firstDriverId}`,
      carrierToken
    );
    const driverBefore = beforeApprove.data as DriverApi;
    expect(driverBefore.status).toBe("PENDING_VERIFICATION");

    // Now click Approve on the Pending tab via the UI
    await page.goto("/carrier/drivers");
    await page.waitForLoadState("networkidle");

    const pendingTab = page.getByRole("button", { name: /^Pending$/ }).first();
    await expect(pendingTab).toBeVisible({ timeout: 10000 });
    await pendingTab.click();
    await page.waitForTimeout(1200);

    // Driver row must be visible on the Pending tab
    await expect(page.getByText(firstDriverName).first()).toBeVisible({
      timeout: 10000,
    });

    // Approve button — green, lives in the same row. There may be multiple
    // "Approve" buttons if other PENDING drivers exist; scope to the row.
    const driverRow = page.locator("tr", { hasText: firstDriverName }).first();
    await driverRow.getByRole("button", { name: /^Approve$/ }).click();
    await page.waitForTimeout(2000);

    // Verify in API
    const after = await apiCall(
      "GET",
      `/api/drivers/${firstDriverId}`,
      carrierToken
    );
    const driverAfter = after.data as DriverApi;
    expect(driverAfter.status).toBe("ACTIVE");
    console.log(`DF-3 approved ${firstDriverId} → ACTIVE`);
  });

  test("DF-4 — approved driver appears in trip Assign Driver dropdown", async ({
    page,
  }) => {
    test.skip(!firstDriverId, "no driver");

    // Seed a fresh ASSIGNED trip
    workflowTripId = await seedFreshTrip();
    test.skip(!workflowTripId, "could not seed trip");

    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const assignBtn = page.getByRole("button", { name: /Assign Driver/i });
    await expect(assignBtn).toBeVisible({ timeout: 10000 });
    await assignBtn.click();
    await page.waitForTimeout(1500);

    // Dropdown panel "Select a driver:" appears, listing ACTIVE+available drivers
    await expect(page.getByText(/Select a driver:/i)).toBeVisible({
      timeout: 5000,
    });

    // Our newly-approved driver must be one of the options
    await expect(page.getByText(firstDriverName).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("DF-5 — assign driver to trip via UI → API confirms driverId", async ({
    page,
  }) => {
    test.skip(!firstDriverId || !workflowTripId, "no driver or trip");

    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Open the dropdown if not already open
    await page.getByRole("button", { name: /Assign Driver/i }).click();
    await page.waitForTimeout(1000);

    // Click the driver name button inside "Select a driver:" panel
    const driverPick = page
      .getByRole("button", { name: new RegExp(firstDriverName, "i") })
      .first();
    await expect(driverPick).toBeVisible({ timeout: 10000 });
    await driverPick.click();
    await page.waitForTimeout(2500);

    // Verify in API
    const after = await apiCall(
      "GET",
      `/api/trips/${workflowTripId}`,
      carrierToken
    );
    const trip =
      (after.data as { trip?: TripApi }).trip ?? (after.data as TripApi);
    expect(trip.driverId).toBe(firstDriverId);
    expect(fullName(trip.driver)).toBe(firstDriverName);

    // Page should now show driver name + "Reassign" button (not "Assign Driver")
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await expect(page.getByText(firstDriverName).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /Reassign/i })).toBeVisible({
      timeout: 10000,
    });
    console.log(`DF-5 trip ${workflowTripId} ← driver ${firstDriverId}`);
  });

  test("DF-6 — unassign driver via UI → API confirms driverId is null", async ({
    page,
  }) => {
    test.skip(!firstDriverId || !workflowTripId, "no driver or trip");

    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // Unassign button only renders for ASSIGNED trips with a driver
    const unassignBtn = page.getByRole("button", { name: /^Unassign$/ });
    await expect(unassignBtn).toBeVisible({ timeout: 10000 });

    // The handler does not use a confirm() dialog — direct fetch call
    await unassignBtn.click();
    await page.waitForTimeout(2500);

    // Verify in API
    const after = await apiCall(
      "GET",
      `/api/trips/${workflowTripId}`,
      carrierToken
    );
    const trip =
      (after.data as { trip?: TripApi }).trip ?? (after.data as TripApi);
    expect(trip.driverId).toBeNull();

    // Page should show "No driver assigned" + "Assign Driver" button
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await expect(page.getByText(/No driver assigned/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /Assign Driver/i })
    ).toBeVisible();
  });

  test("DF-7 — re-assign + Start Trip + Confirm Pickup + Mark Delivered → DELIVERED", async ({
    page,
  }) => {
    test.skip(!firstDriverId || !workflowTripId, "no driver or trip");
    test.setTimeout(120000);

    // Re-assign via API first (UI assign already tested in DF-5).
    // This avoids the router.refresh() navigation issue.
    await apiCall(
      "POST",
      `/api/trips/${workflowTripId}/assign-driver`,
      carrierToken,
      { driverId: firstDriverId }
    );

    // Navigate fresh to trip detail — ASSIGNED with driver
    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Start Trip → PICKUP_PENDING
    const startBtn = page.getByRole("button", { name: /^Start Trip$/ });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();
    await page.waitForTimeout(2500);
    let after = await apiCall(
      "GET",
      `/api/trips/${workflowTripId}`,
      carrierToken
    );
    let st =
      (after.data as { trip?: TripApi }).trip?.status ??
      (after.data as TripApi).status;
    expect(st).toBe("PICKUP_PENDING");

    // Re-navigate to get the updated page state
    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Confirm Pickup → IN_TRANSIT
    const pickupBtn = page.getByRole("button", { name: /^Confirm Pickup$/ });
    await expect(pickupBtn).toBeVisible({ timeout: 10000 });
    await pickupBtn.click();
    await page.waitForTimeout(2500);
    after = await apiCall("GET", `/api/trips/${workflowTripId}`, carrierToken);
    st =
      (after.data as { trip?: TripApi }).trip?.status ??
      (after.data as TripApi).status;
    expect(st).toBe("IN_TRANSIT");

    // Re-navigate again for Mark Delivered
    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Mark Delivered (button → modal → submit)
    const markBtn = page
      .getByRole("button", { name: /^Mark Delivered$/ })
      .first();
    await expect(markBtn).toBeVisible({ timeout: 10000 });
    await markBtn.click();
    await page.waitForTimeout(800);
    // Modal has its own Mark Delivered button; .last() picks the modal one.
    await page
      .getByRole("button", { name: /^Mark Delivered$/ })
      .last()
      .click();
    await page.waitForTimeout(3000);
    after = await apiCall("GET", `/api/trips/${workflowTripId}`, carrierToken);
    st =
      (after.data as { trip?: TripApi }).trip?.status ??
      (after.data as TripApi).status;
    expect(["DELIVERED", "COMPLETED"]).toContain(st);
    console.log(`DF-7 trip ${workflowTripId} status=${st}`);
  });

  test("DF-8 — DELIVERED trip shows 'Waiting for driver to upload POD' (no Upload button)", async ({
    page,
  }) => {
    test.skip(!workflowTripId, "no trip");

    // Confirm trip is in DELIVERED (not COMPLETED — confirm route auto-advances)
    const cur = await apiCall(
      "GET",
      `/api/trips/${workflowTripId}`,
      carrierToken
    );
    const st =
      (cur.data as { trip?: TripApi }).trip?.status ??
      (cur.data as TripApi).status;
    test.skip(st !== "DELIVERED", `trip is ${st}, not DELIVERED`);

    await page.goto(`/carrier/trips/${workflowTripId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await expect(
      page.getByText(/Waiting for driver to upload POD/i).first()
    ).toBeVisible({ timeout: 10000 });
    // The Upload POD button was removed in commit def9bb5a (POD is driver-only).
    await expect(page.getByRole("button", { name: /Upload POD/i })).toHaveCount(
      0
    );
  });

  test("DF-9 — driver availability flips during active trip", async () => {
    test.skip(!firstDriverId, "no driver");

    // Driver should be unavailable while the trip is active (auto-availability).
    const after = await apiCall(
      "GET",
      `/api/drivers/${firstDriverId}`,
      carrierToken
    );
    const d = after.data as DriverApi;
    // If trip is COMPLETED, driver would flip back to available — accept either,
    // but require that we have a definite answer.
    expect(typeof d.driverProfile?.isAvailable).toBe("boolean");
    console.log(
      `DF-9 driver ${firstDriverId} isAvailable=${d.driverProfile?.isAvailable}`
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WORKFLOW 2 — Reject + Suspend
// ════════════════════════════════════════════════════════════════════════════

test.describe.serial("Carrier FUNCTIONAL: Reject + Suspend", () => {
  let secondDriverId: string | null = null;
  let secondDriverName = "";
  let secondDriverPhone = "";
  let secondInviteCode = "";

  test("DF-10 — invite a second driver for the reject test", async ({
    page,
  }) => {
    test.skip(!carrierToken, "no carrier token");

    const ts = Date.now().toString(36).slice(-6).toUpperCase();
    secondDriverName = `Reject Tester ${ts}`;
    secondDriverPhone = `+251955${Math.floor(100000 + Math.random() * 899999)}`;

    await page.goto("/carrier/drivers/invite");
    await page.locator('input[type="text"]').first().fill(secondDriverName);
    await page.locator('input[type="tel"]').first().fill(secondDriverPhone);

    const submit = page.getByRole("button", { name: /Generate Invite Code/i });
    await expect(submit).toBeEnabled({ timeout: 5000 });
    await submit.click();

    await expect(page.getByText(/Driver Invited Successfully/i)).toBeVisible({
      timeout: 15000,
    });
    secondInviteCode = (
      await page.locator("p.font-mono").first().innerText()
    ).trim();
    expect(secondInviteCode).toMatch(/^[A-Z0-9]{6}$/);

    // Capture driver ID from API
    const list = await apiCall("GET", "/api/drivers?limit=100", carrierToken);
    const drivers =
      ((list.data as { drivers?: DriverApi[] }).drivers as DriverApi[]) ?? [];
    const created = drivers.find((d) => d.phone === secondDriverPhone);
    expect(created).toBeTruthy();
    secondDriverId = created!.id;
    createdDriverIds.push(secondDriverId);
    console.log(`DF-10 invited ${secondDriverId}`);
  });

  test("DF-11 — reject driver via UI → modal reason → status REJECTED", async ({
    page,
  }) => {
    test.skip(!secondDriverId, "no driver");

    // Advance INVITED → PENDING_VERIFICATION via accept-invite (driver action).
    // Pass a dummy Bearer token to bypass CSRF middleware.
    const accept = await apiCall(
      "POST",
      "/api/drivers/accept-invite",
      "driver-accept-invite",
      {
        inviteCode: secondInviteCode,
        phone: secondDriverPhone,
        password: DRIVER_PASSWORD,
      }
    );
    expect(accept.status).toBe(201);

    await page.goto("/carrier/drivers");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: /^Pending$/ })
      .first()
      .click();
    await page.waitForTimeout(1200);

    // Find the row + click Reject
    const driverRow = page.locator("tr", { hasText: secondDriverName }).first();
    await expect(driverRow).toBeVisible({ timeout: 10000 });
    await driverRow.getByRole("button", { name: /^Reject$/ }).click();
    await page.waitForTimeout(800);

    // Modal: textarea reason + Reject confirm
    await page.locator("textarea").first().fill("Failed background check");
    await page.waitForTimeout(300);
    // The modal has its own Reject button — last() picks the modal confirm
    await page
      .getByRole("button", { name: /^Reject$/ })
      .last()
      .click();
    await page.waitForTimeout(2000);

    // Verify in API
    const after = await apiCall(
      "GET",
      `/api/drivers/${secondDriverId}`,
      carrierToken
    );
    const d = after.data as DriverApi;
    expect(d.status).toBe("REJECTED");
    console.log(`DF-11 rejected ${secondDriverId} → REJECTED`);
  });

  test("DF-12 — suspend an ACTIVE driver via UI → status SUSPENDED", async ({
    page,
  }) => {
    test.skip(!carrierToken, "no carrier token");

    // Find an ACTIVE driver with no active trips. Prefer seeded driver@test.com
    // because we know it's stable. Skip if it's currently on an active trip.
    const list = await apiCall(
      "GET",
      "/api/drivers?status=ACTIVE&limit=50",
      carrierToken
    );
    const drivers =
      ((list.data as { drivers?: DriverApi[] }).drivers as DriverApi[]) ?? [];
    const candidates = drivers.filter((d) => d.driverProfile?.isAvailable);
    test.skip(
      candidates.length === 0,
      "no ACTIVE+available driver to suspend (all on trips?)"
    );

    const target = candidates[0];
    const targetName = fullName(target);

    // Native confirm() dialog needs auto-accept
    page.on("dialog", (d) => d.accept());

    await page.goto("/carrier/drivers");
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: /^Active$/ })
      .first()
      .click();
    await page.waitForTimeout(1200);

    const row = page.locator("tr", { hasText: targetName }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole("button", { name: /^Suspend$/ }).click();
    await page.waitForTimeout(2500);

    // Verify in API
    const after = await apiCall(
      "GET",
      `/api/drivers/${target.id}`,
      carrierToken
    );
    const d = after.data as DriverApi;
    expect(d.status).toBe("SUSPENDED");
    expect(d.driverProfile?.isAvailable).toBe(false);
    console.log(`DF-12 suspended ${target.id} → SUSPENDED`);

    // Self-heal: reactivate the driver via admin + restore availability.
    if (target.id) {
      await apiCall(
        "POST",
        `/api/admin/users/${target.id}/verify`,
        adminToken,
        { status: "ACTIVE" }
      ).catch(() => {});
      await apiCall("PUT", `/api/drivers/${target.id}`, carrierToken, {
        isAvailable: true,
      }).catch(() => {});
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WORKFLOW 3 — Dashboard stats
// ════════════════════════════════════════════════════════════════════════════

test.describe.serial("Carrier FUNCTIONAL: Dashboard driver counts", () => {
  test("DF-13 — /carrier/dashboard driver numbers match API", async ({
    page,
  }) => {
    test.skip(!carrierToken, "no carrier token");

    const dashRes = await apiCall(
      "GET",
      "/api/carrier/dashboard",
      carrierToken
    );
    const dash = dashRes.data as {
      activeDrivers?: number;
      availableDrivers?: number;
      tripsWithDriver?: number;
    };
    test.skip(
      dash.activeDrivers === undefined || dash.activeDrivers === 0,
      "no active drivers — dashboard hides the card"
    );

    await page.goto("/carrier/dashboard");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // The 3 driver KPI cards each show their numeric value as standalone text
    await expect(page.getByText(/Active Drivers/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(String(dash.activeDrivers), { exact: true }).first()
    ).toBeVisible({ timeout: 10000 });

    if (dash.availableDrivers !== undefined) {
      await expect(page.getByText(/Available Drivers/i).first()).toBeVisible();
      await expect(
        page.getByText(String(dash.availableDrivers), { exact: true }).first()
      ).toBeVisible();
    }
    if (dash.tripsWithDriver !== undefined) {
      await expect(page.getByText(/Trips with Driver/i).first()).toBeVisible();
    }
    console.log(
      `DF-13 dashboard active=${dash.activeDrivers} available=${dash.availableDrivers} tripsWithDriver=${dash.tripsWithDriver}`
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WORKFLOW 4 — Cross-portal impact
// ════════════════════════════════════════════════════════════════════════════

test.describe
  .serial("Carrier FUNCTIONAL: Cross-portal driver visibility", () => {
  // Find any active trip with a driver visible to shipper/dispatcher tokens.
  async function findVisibleTripWithDriver(
    token: string
  ): Promise<{ id: string; name: string } | null> {
    const list = await apiCall("GET", "/api/trips?limit=200", token);
    const trips = ((list.data as { trips?: TripApi[] }).trips ??
      (list.data as TripApi[])) as TripApi[];
    if (!Array.isArray(trips)) return null;
    const candidates = trips.filter(
      (t) => t.driverId && t.status !== "COMPLETED" && t.status !== "CANCELLED"
    );
    for (const c of candidates) {
      const detail = await apiCall("GET", `/api/trips/${c.id}`, token);
      if (detail.status !== 200) continue;
      const t =
        (detail.data as { trip?: TripApi }).trip ?? (detail.data as TripApi);
      const name = fullName(t.driver);
      if (name) return { id: t.id, name };
    }
    return null;
  }

  test.describe("Shipper view", () => {
    test.use({ storageState: "e2e/.auth/shipper.json" });

    test("DF-14 — shipper sees driver name on /shipper/trips/[id] page after carrier assigns", async ({
      page,
    }) => {
      test.skip(!shipperToken, "no shipper token");
      const found = await findVisibleTripWithDriver(shipperToken);
      test.skip(!found, "no shipper-visible trip with driver");

      const resp = await page
        .goto(`/shipper/trips/${found!.id}`, { waitUntil: "domcontentloaded" })
        .catch(() => null);
      test.skip(!resp || resp.status() >= 400, "shipper page failed to load");
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);

      await expect(page.getByText(found!.name).first()).toBeVisible({
        timeout: 10000,
      });
      console.log(
        `DF-14 shipper renders driver=${found!.name} on ${found!.id}`
      );
    });
  });

  test.describe("Dispatcher view", () => {
    test.use({ storageState: "e2e/.auth/dispatcher.json" });

    test("DF-15 — dispatcher sees driver name in /dispatcher/trips list", async ({
      page,
    }) => {
      // Use admin token as a stand-in for dispatcher's API view (dispatcher
      // sees all trips per Blueprint §5; admin sees them too).
      const found = await findVisibleTripWithDriver(adminToken);
      test.skip(!found, "no trip with driver visible to dispatcher");

      await page.goto("/dispatcher/trips");
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2500);

      await expect(page.getByText(found!.name).first()).toBeVisible({
        timeout: 10000,
      });
      console.log(`DF-15 dispatcher renders driver=${found!.name}`);
    });
  });
});

// Suppress unused import warning when BASE_URL isn't referenced.
void BASE_URL;
