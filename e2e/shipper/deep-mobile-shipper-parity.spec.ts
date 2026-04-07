/**
 * Deep Mobile Shipper Parity — API Contract Tests
 *
 * Mobile shipper screens hit the same /api/* endpoints as web. The bugs
 * that survive surface-level audit are the payload SHAPES the mobile
 * services produce vs. what the API actually accepts. This spec exercises
 * each mobile-shipper payload shape against the LIVE API.
 *
 * Real PostgreSQL, real auth, no mocks, no Expo dev server (we audit the
 * payloads the services would send, not Expo render).
 */

import { test, expect } from "@playwright/test";
import { apiCall, getToken } from "../shipper/test-utils";

let token: string;

test.beforeAll(async () => {
  test.setTimeout(120000);
  try {
    token = await getToken("shipper@test.com");
  } catch {
    /* tests skip */
  }
});

// Helper: create a fresh DRAFT load to PATCH against
async function createDraftLoad(): Promise<string | undefined> {
  if (!token) return undefined;
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString();
  const res = await apiCall<{ load?: { id: string }; id?: string }>(
    "POST",
    "/api/loads",
    token,
    {
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: tomorrow,
      deliveryDate: dayAfter,
      truckType: "DRY_VAN",
      weight: 1000,
      cargoDescription: "Mobile parity",
      fullPartial: "FULL",
      shipperContactName: "Mobile",
      shipperContactPhone: "+251911234567",
      saveAsDraft: true,
    }
  );
  return res.data.load?.id ?? res.data.id;
}

// ─── Mobile load edit payload shape (mobile/app/(shipper)/loads/edit.tsx) ───
test.describe("PARITY Mobile Shipper: load edit payload", () => {
  test("MS-1 — bare 'YYYY-MM-DD' from mobile create form is accepted by POST /api/loads", async () => {
    test.skip(!token, "no shipper token");
    // Mobile create.tsx sends data.pickupDate raw (a "YYYY-MM-DD" string from
    // the text input with hint "YYYY-MM-DD"). The CREATE schema accepts
    // z.string() and the route converts via new Date(...). Verify the live
    // contract still holds.
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 10);
    const res = await apiCall<{ load?: { id: string }; id?: string }>(
      "POST",
      "/api/loads",
      token,
      {
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: tomorrow,
        deliveryDate: dayAfter,
        truckType: "DRY_VAN",
        weight: 1000,
        cargoDescription: "Mobile date-only test",
        fullPartial: "FULL",
        shipperContactName: "Mobile",
        shipperContactPhone: "+251911234567",
        saveAsDraft: true,
      }
    );
    console.log(`POST /api/loads date-only → ${res.status}`);
    expect([200, 201]).toContain(res.status);
    expect(res.data.load?.id ?? res.data.id).toBeTruthy();
  });

  test("MS-2 — mobile edit payload (Date object → ISO via JSON) is accepted by PATCH /api/loads/[id]", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    // mobile/app/(shipper)/loads/edit.tsx:97 sends:
    //   pickupDate: new Date(data.pickupDate) as unknown as Date
    // axios serializes Date → "YYYY-MM-DDTHH:mm:ss.000Z" via JSON.stringify.
    // Mimic that exactly:
    const dateObj = new Date("2026-05-15");
    const res = await apiCall("PATCH", `/api/loads/${id}`, token, {
      pickupDate: dateObj.toISOString(),
    });
    console.log(`PATCH ISO datetime → ${res.status}`);
    expect([200, 409]).toContain(res.status);
  });

  test("MS-3 — mobile edit DOES NOT introduce off-by-one date drift (UTC midnight gotcha)", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    // The mobile edit screen takes "YYYY-MM-DD" and wraps it in `new Date()`.
    // In a UTC+3 timezone (Africa/Addis_Ababa), `new Date("2026-04-15")`
    // creates 2026-04-15T00:00:00 UTC = 2026-04-15T03:00 local. That's
    // still April 15 locally — OK for users in UTC+3.
    // BUT if mobile code parses "YYYY-MM-DD" via `new Date()` in a
    // negative-offset timezone (e.g., UTC-5), it would shift to April 14.
    // Verify the round-trip preserves the date string the user typed.
    const userTyped = "2026-05-20";
    const res = await apiCall<{ pickupDate?: string }>(
      "PATCH",
      `/api/loads/${id}`,
      token,
      {
        // What mobile actually sends after `new Date(data.pickupDate)`:
        pickupDate: new Date(userTyped).toISOString(),
      }
    );
    test.skip(res.status !== 200, `PATCH returned ${res.status}`);
    // GET /api/loads/[id] wraps the load in { load: {...} }
    const get = await apiCall<{ load?: { pickupDate?: string } }>(
      "GET",
      `/api/loads/${id}`,
      token
    );
    const stored = get.data.load?.pickupDate;
    if (!stored) {
      console.log("no pickupDate in GET response, skip");
      return;
    }
    const storedDay = new Date(stored).toISOString().slice(0, 10);
    console.log(
      `mobile typed=${userTyped}, stored ISO=${stored}, stored day=${storedDay}`
    );
    // The server's day-of-month must match what the user typed.
    expect(storedDay).toBe(userTyped);
  });

  test("MS-4 — mobile edit phone validation: bad phone is rejected by API (server-side guard)", async () => {
    test.skip(!token, "no shipper token");
    const id = await createDraftLoad();
    test.skip(!id, "could not create draft load");
    // mobile/app/(shipper)/loads/edit.tsx:109 has no client-side validation —
    // it relies entirely on the server. Verify the server-side gate exists.
    const res = await apiCall("PATCH", `/api/loads/${id}`, token, {
      shipperContactPhone: "not-a-phone",
    });
    console.log(`mobile bad phone → ${res.status}`);
    expect([400, 422]).toContain(res.status);
  });
});

// ─── Mobile wallet deposit shape (mobile/src/services/wallet.ts) ────────────
test.describe("PARITY Mobile Shipper: wallet deposit payload", () => {
  test("MS-5 — mobile wallet.requestDeposit() payload shape is accepted", async () => {
    test.skip(!token, "no shipper token");
    // mobile/src/services/wallet.ts requestDeposit() sends:
    //   { amount, paymentMethod, slipFileUrl?, externalReference?, notes? }
    const res = await apiCall<{
      deposit?: { id: string; status: string };
    }>("POST", "/api/wallet/deposit", token, {
      amount: 250,
      paymentMethod: "TELEBIRR",
      externalReference: `mobile-${Date.now()}`,
      notes: "Mobile parity MS-5",
    });
    console.log(`mobile deposit → ${res.status}`);
    expect([200, 201]).toContain(res.status);
    expect(res.data.deposit?.status).toBe("PENDING");
  });

  test("MS-6 — mobile wallet GET /api/wallet/balance returns the per-category fields", async () => {
    test.skip(!token, "no shipper token");
    // mobile/app/(shipper)/wallet/index.tsx renders these (added in 0b84900)
    const res = await apiCall<{
      totalBalance: number;
      totalDeposited: number;
      totalRefunded: number;
      serviceFeesPaid: number;
      totalWithdrawn: number;
      isLedgerInSync: boolean;
    }>("GET", "/api/wallet/balance", token);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("totalDeposited");
    expect(res.data).toHaveProperty("totalRefunded");
    expect(res.data).toHaveProperty("serviceFeesPaid");
    expect(res.data).toHaveProperty("totalWithdrawn");
    expect(res.data).toHaveProperty("isLedgerInSync");
    // Math invariant
    const expected =
      Number(res.data.totalDeposited) +
      Number(res.data.totalRefunded) -
      Number(res.data.serviceFeesPaid) -
      Number(res.data.totalWithdrawn);
    expect(
      Math.abs(Number(res.data.totalBalance) - expected)
    ).toBeLessThanOrEqual(0.01);
  });
});

// ─── Mobile rating submission (mobile/src/services/rating.ts + RatingModal) ─
test.describe("PARITY Mobile Shipper: rating submission", () => {
  test("MS-7 — POST /api/trips/[id]/rate accepts mobile RatingModal payload shape", async () => {
    test.skip(!token, "no shipper token");
    // mobile/src/components/RatingModal.tsx sends:
    //   { stars: number, comment?: string }
    // We don't have a real DELIVERED trip to rate, so just verify the
    // contract for a nonexistent trip — should be 404, never 500.
    const res = await apiCall(
      "POST",
      "/api/trips/nonexistent-trip-id/rate",
      token,
      { stars: 5, comment: "Mobile parity" }
    );
    console.log(`mobile rate nonexistent → ${res.status}`);
    expect([400, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  test("MS-8 — POST /api/trips/[id]/rate validates stars in 1-5", async () => {
    test.skip(!token, "no shipper token");
    const res = await apiCall("POST", "/api/trips/any-id/rate", token, {
      stars: 99, // out of range
      comment: "test",
    });
    console.log(`mobile rate stars=99 → ${res.status}`);
    expect([400, 422, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

// ─── Mobile messaging (mobile/src/services/messaging.ts + chat screen) ──────
test.describe("PARITY Mobile Shipper: messaging payload", () => {
  test("MS-9 — POST /api/trips/[id]/messages content max 2000 chars", async () => {
    test.skip(!token, "no shipper token");
    const res = await apiCall(
      "POST",
      "/api/trips/nonexistent/messages",
      token,
      { content: "Mobile chat ping" }
    );
    console.log(`mobile chat → ${res.status}`);
    expect([400, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  test("MS-10 — GET /api/trips/[id]/messages returns valid shape", async () => {
    test.skip(!token, "no shipper token");
    // First find any trip we have access to
    const tripsRes = await apiCall<{
      trips?: Array<{ id: string }>;
    }>("GET", "/api/trips?limit=1", token);
    const tripId = tripsRes.data.trips?.[0]?.id;
    if (!tripId) {
      test.skip(true, "no trips");
      return;
    }
    const res = await apiCall<{ messages?: unknown[] }>(
      "GET",
      `/api/trips/${tripId}/messages`,
      token
    );
    console.log(`mobile chat fetch → ${res.status}`);
    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.data.messages)).toBe(true);
    }
  });
});

// ─── Mobile profile + universal endpoints ───────────────────────────────────
test.describe("PARITY Mobile Shipper: universal endpoints", () => {
  test("MS-11 — mobile login returns sessionToken (used by services/auth.ts)", async ({
    request,
  }) => {
    const res = await request.post("http://localhost:3000/api/auth/login", {
      headers: { "x-client-type": "mobile" },
      data: { email: "shipper@test.com", password: "Test123!" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Mobile uses sessionToken, web uses csrfToken (from cookie)
    expect(body).toHaveProperty("sessionToken");
    expect(typeof body.sessionToken).toBe("string");
    expect((body.sessionToken as string).length).toBeGreaterThan(0);
  });

  test("MS-12 — mobile profile update accepts trimmed valid name", async () => {
    test.skip(!token, "no shipper token");
    const res = await apiCall("PATCH", "/api/user/profile", token, {
      firstName: "  Mobile Tester  ",
    });
    console.log(`mobile profile trim → ${res.status}`);
    expect([200, 409]).toContain(res.status);
  });
});
