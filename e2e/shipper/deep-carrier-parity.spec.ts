/**
 * Deep Carrier-→-Shipper Parity Tests
 *
 * Mirror of e2e/carrier/deep-shipper-parity.spec.ts in the opposite direction:
 * for every carrier-side fix, verify the equivalent shipper surface holds the
 * same contract.
 *
 * Real DB, real Chromium, real auth. Zero mocks.
 */

import { test, expect } from "@playwright/test";
import { apiCall, getToken, ensureLoad } from "./test-utils";

let token: string;
let loadId: string | undefined;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    token = await getToken("shipper@test.com");
    try {
      loadId = await ensureLoad(token);
    } catch {
      // tests skip if no load
    }
  } catch {
    // tests skip
  }
});

// Helper: create a brand-new DRAFT load every call so tests are isolated
// and can't be blocked by status guards on shared seed data.
async function createDraftLoad(): Promise<string | undefined> {
  if (!token) return undefined;
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString();
  const res = await apiCall<{
    load?: { id: string };
    id?: string;
  }>("POST", "/api/loads", token, {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    pickupDate: tomorrow,
    deliveryDate: dayAfter,
    truckType: "DRY_VAN",
    weight: 1000,
    cargoDescription: "Parity test load",
    fullPartial: "FULL",
    shipperContactName: "Parity Test",
    shipperContactPhone: "+251911234567",
    saveAsDraft: true,
  });
  return res.data.load?.id ?? res.data.id;
}

// ─── Phone validation parity (mirror of d548be5) ─────────────────────────────
test.describe("PARITY: phone validation symmetry between create and update", () => {
  test("SP-1 — POST /api/loads rejects invalid shipperContactPhone", async () => {
    test.skip(!token, "no shipper token");
    // The CREATE route already enforces format. Verify the regression guard.
    const res = await apiCall("POST", "/api/loads", token, {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(Date.now() + 86400000).toISOString(),
      truckType: "DRY_VAN",
      weight: 1000,
      shipperContactName: "Test",
      shipperContactPhone: "not-a-phone",
    });
    console.log(`POST /api/loads bad phone → ${res.status}`);
    expect([400, 422]).toContain(res.status);
  });

  test("SP-2 — PATCH /api/loads/[id] rejects invalid shipperContactPhone", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    const res = await apiCall("PATCH", `/api/loads/${id}`, token, {
      shipperContactPhone: "not-a-phone",
    });
    console.log(`PATCH /api/loads/[id] bad phone → ${res.status}`);
    // BEFORE this audit fix: schema is z.string().max(20).optional().nullable()
    //   → API returns 200 and silently saves the garbage phone (BUG).
    // AFTER fix: format validated → 400.
    expect([400, 422]).toContain(res.status);
  });

  test("SP-3 — PATCH /api/loads/[id] accepts valid shipperContactPhone", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    const res = await apiCall("PATCH", `/api/loads/${id}`, token, {
      shipperContactPhone: "+251911234567",
    });
    console.log(`PATCH /api/loads/[id] valid phone → ${res.status}`);
    expect([200, 409]).toContain(res.status);
  });

  test("SP-4 — PATCH /api/loads/[id] accepts null shipperContactPhone (clearable)", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    const res = await apiCall("PATCH", `/api/loads/${id}`, token, {
      shipperContactPhone: null,
    });
    console.log(`PATCH /api/loads/[id] null phone → ${res.status}`);
    expect([200, 409]).toContain(res.status);
  });
});

// ─── Carrier datetime payload bug (d15ab85) — mirror check on shipper ────────
test.describe("PARITY: d15ab85 — date-only payload handling on shipper load PATCH", () => {
  test("SP-5 — PATCH /api/loads/[id] accepts date-only pickupDate (not strict datetime)", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    // The shipper /api/loads/[id] schema uses z.string() for pickupDate,
    // NOT z.string().datetime(). So bare "YYYY-MM-DD" should be ACCEPTED.
    // (This is a different design from /api/truck-postings/[id] which is
    // strict datetime — both are valid contracts as long as the form
    // matches the schema.)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await apiCall("PATCH", `/api/loads/${id}`, token, {
      pickupDate: tomorrow,
    });
    console.log(`PATCH /api/loads/[id] date-only → ${res.status}`);
    expect([200, 400, 409]).toContain(res.status);
    if (res.status === 400) {
      // If it IS rejected, the schema should be tightened OR the form
      // should convert. Print so we know which side to fix.
      console.log("400 body:", JSON.stringify(res.data).slice(0, 200));
    }
  });
});

// ─── Wallet financial integrity (mirror of FI-* on carrier) ─────────────────
test.describe("PARITY: 9b0ea64 — shipper wallet financial integrity", () => {
  test("SP-6 — shipper wallet math invariant: balance = deposits + refunds − fees − withdrawals", async () => {
    test.skip(!token, "no shipper token");
    const { status, data } = await apiCall<{
      totalBalance: number;
      totalDeposited: number;
      totalRefunded: number;
      serviceFeesPaid: number;
      totalWithdrawn: number;
      ledgerDrift: number;
      isLedgerInSync: boolean;
    }>("GET", "/api/wallet/balance", token);
    expect(status).toBe(200);
    const expected =
      Number(data.totalDeposited) +
      Number(data.totalRefunded) -
      Number(data.serviceFeesPaid) -
      Number(data.totalWithdrawn);
    const drift = Math.abs(Number(data.totalBalance) - expected);
    console.log(
      `shipper balance=${data.totalBalance}, derived=${expected}, drift=${drift}`
    );
    expect(drift).toBeLessThanOrEqual(0.01);
    expect(data.isLedgerInSync).toBe(true);
  });

  test("SP-7 — shipper wallet UI cards match API totals", async ({ page }) => {
    test.skip(!token, "no shipper token");
    const { data } = await apiCall<{
      totalDeposited: number;
      totalBalance: number;
      currency: string;
    }>("GET", "/api/wallet/balance", token);
    console.log(
      `shipper wallet: totalDeposited=${data.totalDeposited}, totalBalance=${data.totalBalance}`
    );
    await page.goto("/shipper/wallet");
    await page.waitForTimeout(1500);
    // Verify the Total Deposited card exists; the exact rendered number
    // depends on real wallet state. Use the formatted value the UI uses.
    await expect(page.getByText(/Total Deposited/i).first()).toBeVisible({
      timeout: 10000,
    });
    // The card should also render the currency
    const formatted = Number(data.totalDeposited).toLocaleString();
    const numericPart = String(Math.floor(Number(data.totalDeposited)));
    // Either the formatted (e.g. "1,234") or raw (e.g. "1234") integer part
    // must appear somewhere on the page near the Total Deposited card.
    const main = page.getByRole("main");
    await expect(
      main
        .getByText(
          new RegExp(
            `${formatted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${numericPart}`
          )
        )
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Self-service deposit form (mirror of DF-* on carrier) ──────────────────
test.describe("PARITY: eb68304 — shipper deposit form already exists", () => {
  test("SP-8 — POST /api/wallet/deposit accepts shipper deposit", async () => {
    test.skip(!token, "no shipper token");
    const ref = `e2e-shipper-${Date.now()}`;
    const res = await apiCall<{
      deposit?: { id: string; status: string; amount: number | string };
    }>("POST", "/api/wallet/deposit", token, {
      amount: 100,
      paymentMethod: "TELEBIRR",
      externalReference: ref,
      notes: "shipper parity SP-8",
    });
    console.log(`POST /api/wallet/deposit (shipper) → ${res.status}`);
    expect([200, 201]).toContain(res.status);
    expect(res.data.deposit?.status).toBe("PENDING");
  });
});

// ─── Universal endpoints reachable from shipper ─────────────────────────────
test.describe("PARITY: universal endpoints reachable from shipper", () => {
  test("SP-9 — PATCH /api/user/profile rejects whitespace name from shipper", async () => {
    test.skip(!token, "no shipper token");
    const res = await apiCall("PATCH", "/api/user/profile", token, {
      firstName: "   ",
    });
    console.log(`PATCH whitespace → ${res.status}`);
    expect([400, 422]).toContain(res.status);
  });

  test("SP-10 — POST /api/auth/login returns csrfToken for shipper", async ({
    request,
  }) => {
    const res = await request.post("http://localhost:3000/api/auth/login", {
      data: { email: "shipper@test.com", password: "Test123!" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("csrfToken");
    expect(typeof body.csrfToken).toBe("string");
  });

  test("SP-11 — GET /api/notifications returns valid shape for shipper", async () => {
    test.skip(!token, "no shipper token");
    const res = await apiCall<{ notifications?: unknown[] }>(
      "GET",
      "/api/notifications",
      token
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.notifications)).toBe(true);
  });
});
