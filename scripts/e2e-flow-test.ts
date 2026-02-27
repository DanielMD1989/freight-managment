/**
 * E2E Flow Test: Load → Match → Proposal → Trip → Completion
 *
 * Tests the complete business flow using API routes directly.
 * Uses test users from seed data (all password: "password").
 *
 * Run: npx tsx scripts/e2e-flow-test.ts
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Session {
  sessionToken: string;
  csrfToken: string;
  csrfCookie: string;
  user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  };
}

interface StepResult {
  step: number;
  name: string;
  api: string;
  method: string;
  body?: any;
  status: number;
  pass: boolean;
  data?: any;
  error?: string;
}

const results: StepResult[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractCookies(setCookieHeaders: string[]): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match) {
      cookies[match[1]] = match[2];
    }
  }
  return cookies;
}

async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-type": "mobile", // Get sessionToken in response body
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${data.error}`);
  }

  // Extract cookies from response
  const setCookieHeaders = res.headers.getSetCookie?.() || [];
  const cookies = extractCookies(setCookieHeaders);

  return {
    sessionToken: data.sessionToken,
    csrfToken: data.csrfToken,
    csrfCookie: cookies["csrf_token"] || data.csrfToken,
    user: data.user,
  };
}

function authHeaders(
  session: Session,
  includeCsrf = false
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.sessionToken}`,
  };
  if (includeCsrf) {
    headers["x-csrf-token"] = session.csrfToken;
    headers["Cookie"] = `csrf_token=${session.csrfCookie}`;
  }
  return headers;
}

async function apiCall(
  method: string,
  path: string,
  session: Session,
  body?: any,
  needsCsrf = false
): Promise<{ status: number; data: any }> {
  const opts: RequestInit = {
    method,
    headers: authHeaders(session, needsCsrf),
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function record(result: StepResult) {
  results.push(result);
  const icon = result.pass ? "✅" : "❌";
  console.log(`\n${icon} Step ${result.step}: ${result.name}`);
  console.log(`   ${result.method} ${result.api}`);
  if (result.body) {
    console.log(
      `   Body: ${JSON.stringify(result.body, null, 2).split("\n").join("\n   ")}`
    );
  }
  console.log(`   Status: ${result.status}`);
  if (result.data) {
    const preview = JSON.stringify(result.data, null, 2);
    const lines = preview.split("\n");
    if (lines.length > 25) {
      console.log(`   Response: ${lines.slice(0, 25).join("\n   ")}...`);
    } else {
      console.log(`   Response: ${preview.split("\n").join("\n   ")}`);
    }
  }
  if (result.error) console.log(`   Error: ${result.error}`);
}

// ─── Main Test Flow ──────────────────────────────────────────────────────────

async function main() {
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("  E2E FLOW TEST: Load → Match → Proposal → Trip → Completion");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log("");

  // ─── Setup: Login all users ─────────────────────────────────────────────

  console.log("━━━ SETUP: Logging in test users ━━━");

  let shipper: Session;
  let carrier: Session;
  let dispatcher: Session;
  let admin: Session;

  try {
    [shipper, carrier, dispatcher, admin] = await Promise.all([
      login("shipper@test.com", "password"),
      login("carrier@test.com", "password"),
      login("dispatcher@test.com", "password"),
      login("admin@test.com", "password"),
    ]);
    console.log(
      `  ✅ Shipper:    ${shipper.user.email} (org: ${shipper.user.organizationId})`
    );
    console.log(
      `  ✅ Carrier:    ${carrier.user.email} (org: ${carrier.user.organizationId})`
    );
    console.log(
      `  ✅ Dispatcher: ${dispatcher.user.email} (org: ${dispatcher.user.organizationId})`
    );
    console.log(`  ✅ Admin:      ${admin.user.email}`);
  } catch (err: any) {
    console.error(`\n❌ SETUP FAILED: ${err.message}`);
    console.error(
      "   Make sure the dev server is running and seed data is loaded."
    );
    console.error("   Run: npx tsx scripts/seed-test-data.ts");
    process.exit(1);
  }

  // Capture initial wallet balances for comparison at the end
  const [initialShipperWallet, initialCarrierWallet] = await Promise.all([
    apiCall("GET", "/api/wallet/balance", shipper),
    apiCall("GET", "/api/wallet/balance", carrier),
  ]);
  const initialShipperBalance =
    initialShipperWallet.data?.totalBalance ?? "N/A";
  const initialCarrierBalance =
    initialCarrierWallet.data?.totalBalance ?? "N/A";
  console.log(`\n  💰 Initial Shipper Balance: ${initialShipperBalance} ETB`);
  console.log(`  💰 Initial Carrier Balance: ${initialCarrierBalance} ETB`);

  // Track IDs through the flow
  let loadId: string;
  let truckId: string;
  let truckPostingId: string;
  let proposalId: string;
  let tripId: string;

  // ─── Step 1: Shipper creates a new load ─────────────────────────────────

  const step1Body = {
    pickupCity: "Addis Ababa",
    deliveryCity: "Dire Dawa",
    truckType: "DRY_VAN",
    weight: 10000,
    pickupDate: "2026-02-06",
    deliveryDate: "2026-02-08",
    cargoDescription: "E2E Test Load - electronics shipment",
    tripKm: 453,
    originLat: 9.02,
    originLon: 38.75,
    destinationLat: 9.6,
    destinationLon: 41.85,
    status: "POSTED",
  };

  const step1 = await apiCall("POST", "/api/loads", shipper, step1Body);
  loadId = step1.data?.load?.id || "";

  record({
    step: 1,
    name: "Shipper creates a new load",
    api: "/api/loads",
    method: "POST",
    body: step1Body,
    status: step1.status,
    pass: step1.status === 201 && step1.data?.load?.status === "POSTED",
    data: step1.data?.load
      ? {
          id: step1.data.load.id,
          status: step1.data.load.status,
          pickupCity: step1.data.load.pickupCity,
          deliveryCity: step1.data.load.deliveryCity,
        }
      : step1.data,
    error:
      step1.status !== 201
        ? step1.data?.error || `Unexpected status ${step1.status}`
        : undefined,
  });

  if (!loadId) {
    console.error("\n⛔ Cannot continue without a load ID. Aborting.");
    printSummary();
    process.exit(1);
  }

  // ─── Step 2: Find matching trucks for the load ──────────────────────────

  const step2 = await apiCall(
    "GET",
    `/api/loads/${loadId}/matching-trucks`,
    shipper
  );
  const matchingTrucks = step2.data?.trucks || [];
  const matchedTruck =
    matchingTrucks.find((t: any) => t.truck?.truckType === "DRY_VAN") ||
    matchingTrucks[0];
  truckId = matchedTruck?.truck?.id || "";
  truckPostingId = matchedTruck?.id || "";

  record({
    step: 2,
    name: "Find matching trucks for the load",
    api: `/api/loads/${loadId}/matching-trucks`,
    method: "GET",
    status: step2.status,
    pass: step2.status === 200 && matchingTrucks.length > 0,
    data: {
      total: step2.data?.total,
      exactMatches: step2.data?.exactMatches,
      topMatch: matchedTruck
        ? {
            postingId: matchedTruck.id,
            truckId: matchedTruck.truck?.id,
            truckType: matchedTruck.truck?.truckType,
            licensePlate: matchedTruck.truck?.licensePlate,
            matchScore: matchedTruck.matchScore,
            carrier: matchedTruck.carrier?.name,
          }
        : null,
    },
    error:
      step2.status !== 200
        ? step2.data?.error
        : matchingTrucks.length === 0
          ? "No matching trucks found"
          : undefined,
  });

  // ─── Step 3: Carrier sees matching loads for their truck posting ────────

  let step3Pass = false;
  let step3Data: any = {};
  let step3Status = 0;
  let step3Error: string | undefined;

  if (truckPostingId) {
    const step3Res = await apiCall(
      "GET",
      `/api/truck-postings/${truckPostingId}/matching-loads`,
      carrier
    );
    step3Status = step3Res.status;
    const matches = step3Res.data?.matches || [];
    const ourLoad = matches.find((m: any) => m.load?.id === loadId);
    step3Pass = step3Res.status === 200 && !!ourLoad;
    step3Data = {
      totalMatches: step3Res.data?.totalMatches,
      ourLoadFound: !!ourLoad,
      ourLoadScore: ourLoad?.matchScore,
    };
    step3Error =
      !ourLoad && step3Res.status === 200
        ? "Our test load not found in matching results"
        : step3Res.data?.error;
  } else {
    step3Status = 0;
    step3Error = "No truck posting ID from step 2";
  }

  record({
    step: 3,
    name: "Carrier sees matching loads for their truck posting",
    api: `/api/truck-postings/${truckPostingId}/matching-loads`,
    method: "GET",
    status: step3Status,
    pass: step3Pass,
    data: step3Data,
    error: step3Error,
  });

  // ─── Step 4: Dispatcher creates match proposal ──────────────────────────

  const step4Body = {
    loadId,
    truckId,
    proposedRate: 15000,
    notes: "E2E test match proposal",
    expiresInHours: 24,
  };

  const step4 = await apiCall(
    "POST",
    "/api/match-proposals",
    dispatcher,
    step4Body,
    true
  );
  proposalId = step4.data?.proposal?.id || "";

  record({
    step: 4,
    name: "Dispatcher creates match proposal",
    api: "/api/match-proposals",
    method: "POST",
    body: step4Body,
    status: step4.status,
    pass: step4.status === 201 && step4.data?.proposal?.status === "PENDING",
    data: step4.data?.proposal
      ? {
          id: step4.data.proposal.id,
          status: step4.data.proposal.status,
          loadId: step4.data.proposal.loadId,
          truckId: step4.data.proposal.truckId,
        }
      : step4.data,
    error:
      step4.status !== 201
        ? step4.data?.error || `Unexpected status ${step4.status}`
        : undefined,
  });

  if (!proposalId) {
    console.error("\n⛔ Cannot continue without a proposal ID. Aborting.");
    printSummary();
    process.exit(1);
  }

  // ─── Step 5: Carrier accepts proposal → Trip created automatically ──────

  const step5Body = { action: "ACCEPT", responseNotes: "E2E test acceptance" };
  const step5 = await apiCall(
    "POST",
    `/api/match-proposals/${proposalId}/respond`,
    carrier,
    step5Body
  );
  tripId = step5.data?.trip?.id || "";

  record({
    step: 5,
    name: "Carrier accepts proposal → Trip created automatically",
    api: `/api/match-proposals/${proposalId}/respond`,
    method: "POST",
    body: step5Body,
    status: step5.status,
    pass:
      step5.status === 200 &&
      step5.data?.proposal?.status === "ACCEPTED" &&
      !!step5.data?.trip,
    data: {
      proposalStatus: step5.data?.proposal?.status,
      loadStatus: step5.data?.load?.status,
      tripCreated: !!step5.data?.trip,
      tripId: step5.data?.trip?.id,
      tripStatus: step5.data?.trip?.status,
      serviceFee: step5.data?.serviceFee,
      message: step5.data?.message,
    },
    error:
      step5.status !== 200
        ? step5.data?.error || `Unexpected status ${step5.status}`
        : undefined,
  });

  if (!tripId) {
    console.error("\n⛔ Cannot continue without a trip ID. Aborting.");
    printSummary();
    process.exit(1);
  }

  // ─── Step 6: Verify trip was created correctly ──────────────────────────

  const step6 = await apiCall("GET", `/api/trips/${tripId}`, carrier);

  record({
    step: 6,
    name: "Verify trip was created with correct data",
    api: `/api/trips/${tripId}`,
    method: "GET",
    status: step6.status,
    pass:
      step6.status === 200 &&
      step6.data?.trip?.status === "ASSIGNED" &&
      step6.data?.trip?.loadId === loadId,
    data: step6.data?.trip
      ? {
          id: step6.data.trip.id,
          status: step6.data.trip.status,
          loadId: step6.data.trip.loadId,
          truckId: step6.data.trip.truckId,
          carrierId: step6.data.trip.carrier?.id,
          shipperId: step6.data.trip.shipper?.id,
          pickupCity: step6.data.trip.pickupCity,
          deliveryCity: step6.data.trip.deliveryCity,
        }
      : step6.data,
    error: step6.status !== 200 ? step6.data?.error : undefined,
  });

  // ─── Step 7: Carrier progresses trip: ASSIGNED → PICKUP_PENDING ─────────

  const step7Body = { status: "PICKUP_PENDING" };
  const step7 = await apiCall(
    "PATCH",
    `/api/trips/${tripId}`,
    carrier,
    step7Body
  );

  record({
    step: 7,
    name: "Carrier starts pickup (ASSIGNED → PICKUP_PENDING)",
    api: `/api/trips/${tripId}`,
    method: "PATCH",
    body: step7Body,
    status: step7.status,
    pass: step7.status === 200 && step7.data?.trip?.status === "PICKUP_PENDING",
    data: {
      tripStatus: step7.data?.trip?.status,
      loadSynced: step7.data?.loadSynced,
      message: step7.data?.message,
    },
    error:
      step7.status !== 200
        ? step7.data?.error || `Unexpected status ${step7.status}`
        : undefined,
  });

  // ─── Step 8: Carrier picks up: PICKUP_PENDING → IN_TRANSIT ──────────────

  const step8Body = { status: "IN_TRANSIT" };
  const step8 = await apiCall(
    "PATCH",
    `/api/trips/${tripId}`,
    carrier,
    step8Body
  );

  record({
    step: 8,
    name: "Carrier picks up load (PICKUP_PENDING → IN_TRANSIT)",
    api: `/api/trips/${tripId}`,
    method: "PATCH",
    body: step8Body,
    status: step8.status,
    pass: step8.status === 200 && step8.data?.trip?.status === "IN_TRANSIT",
    data: {
      tripStatus: step8.data?.trip?.status,
      loadSynced: step8.data?.loadSynced,
    },
    error:
      step8.status !== 200
        ? step8.data?.error || `Unexpected status ${step8.status}`
        : undefined,
  });

  // ─── Step 9: Carrier delivers: IN_TRANSIT → DELIVERED ───────────────────

  const step9Body = {
    status: "DELIVERED",
    receiverName: "E2E Test Receiver",
    receiverPhone: "+251911000000",
    deliveryNotes: "Delivered at warehouse gate B",
  };
  const step9 = await apiCall(
    "PATCH",
    `/api/trips/${tripId}`,
    carrier,
    step9Body
  );

  record({
    step: 9,
    name: "Carrier delivers load (IN_TRANSIT → DELIVERED)",
    api: `/api/trips/${tripId}`,
    method: "PATCH",
    body: step9Body,
    status: step9.status,
    pass: step9.status === 200 && step9.data?.trip?.status === "DELIVERED",
    data: {
      tripStatus: step9.data?.trip?.status,
      loadSynced: step9.data?.loadSynced,
    },
    error:
      step9.status !== 200
        ? step9.data?.error || `Unexpected status ${step9.status}`
        : undefined,
  });

  // ─── Step 10: Attempt completion without POD (expect rejection) ─────────

  const step10Body = { status: "COMPLETED" };
  const step10 = await apiCall(
    "PATCH",
    `/api/trips/${tripId}`,
    carrier,
    step10Body
  );
  const podRequired =
    step10.status === 400 &&
    (step10.data?.requiresPod || step10.data?.awaitingVerification);

  record({
    step: 10,
    name: "Attempt completion without POD (expects rejection)",
    api: `/api/trips/${tripId}`,
    method: "PATCH",
    body: step10Body,
    status: step10.status,
    pass: podRequired,
    data: {
      requiresPod: step10.data?.requiresPod,
      awaitingVerification: step10.data?.awaitingVerification,
      error: step10.data?.error,
      note: podRequired
        ? "Correctly blocked - POD required before completion"
        : undefined,
    },
    error: !podRequired
      ? "Expected POD requirement but got different response"
      : undefined,
  });

  // ─── Step 11: Carrier uploads POD ───────────────────────────────────────

  // Create a minimal test PNG file (1x1 pixel)
  const pngBytes = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x02,
    0x00,
    0x00,
    0x00,
    0x90,
    0x77,
    0x53,
    0xde,
    0x00,
    0x00,
    0x00,
    0x0c,
    0x49,
    0x44,
    0x41, // IDAT chunk
    0x54,
    0x08,
    0xd7,
    0x63,
    0xf8,
    0xcf,
    0xc0,
    0x00,
    0x00,
    0x00,
    0x02,
    0x00,
    0x01,
    0xe2,
    0x21,
    0xbc,
    0x33,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e, // IEND chunk
    0x44,
    0xae,
    0x42,
    0x60,
    0x82,
  ]);

  const formData = new FormData();
  const blob = new Blob([pngBytes], { type: "image/png" });
  formData.append("file", blob, "e2e-test-pod.png");
  formData.append("notes", "E2E test POD document");

  const podUploadRes = await fetch(`${BASE_URL}/api/trips/${tripId}/pod`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${carrier.sessionToken}`,
    },
    body: formData,
  });
  const podUploadData = await podUploadRes.json().catch(() => ({}));

  record({
    step: 11,
    name: "Carrier uploads Proof of Delivery (POD)",
    api: `/api/trips/${tripId}/pod`,
    method: "POST",
    body: {
      file: "e2e-test-pod.png (1x1 PNG)",
      notes: "E2E test POD document",
    },
    status: podUploadRes.status,
    pass: podUploadRes.status === 200 && !!podUploadData?.pod,
    data: podUploadData?.pod || podUploadData,
    error:
      podUploadRes.status !== 200
        ? podUploadData?.error ||
          `Upload failed with status ${podUploadRes.status}`
        : undefined,
  });

  // ─── Step 12: Shipper verifies POD ──────────────────────────────────────

  const step12 = await apiCall("PUT", `/api/loads/${loadId}/pod`, shipper);

  record({
    step: 12,
    name: "Shipper verifies POD",
    api: `/api/loads/${loadId}/pod`,
    method: "PUT",
    status: step12.status,
    pass: step12.status === 200 && step12.data?.load?.podVerified === true,
    data: step12.data?.load || step12.data,
    error:
      step12.status !== 200
        ? step12.data?.error ||
          `Verification failed with status ${step12.status}`
        : undefined,
  });

  // ─── Step 13: Complete the trip (DELIVERED → COMPLETED) ─────────────────

  const step13Body = { status: "COMPLETED" };
  const step13 = await apiCall(
    "PATCH",
    `/api/trips/${tripId}`,
    carrier,
    step13Body
  );

  record({
    step: 13,
    name: "Carrier completes trip (DELIVERED → COMPLETED)",
    api: `/api/trips/${tripId}`,
    method: "PATCH",
    body: step13Body,
    status: step13.status,
    pass: step13.status === 200 && step13.data?.trip?.status === "COMPLETED",
    data: {
      tripStatus: step13.data?.trip?.status,
      loadSynced: step13.data?.loadSynced,
      message: step13.data?.message,
    },
    error:
      step13.status !== 200
        ? step13.data?.error || `Completion failed with status ${step13.status}`
        : undefined,
  });

  // ─── Step 14: Verify financial transactions ─────────────────────────────

  const [finalShipperWallet, finalCarrierWallet] = await Promise.all([
    apiCall("GET", "/api/wallet/balance", shipper),
    apiCall("GET", "/api/wallet/balance", carrier),
  ]);

  const [shipperTxns, carrierTxns] = await Promise.all([
    apiCall("GET", "/api/wallet/transactions?limit=5", shipper),
    apiCall("GET", "/api/wallet/transactions?limit=5", carrier),
  ]);

  const finalShipperBalance = finalShipperWallet.data?.totalBalance;
  const finalCarrierBalance = finalCarrierWallet.data?.totalBalance;

  record({
    step: 14,
    name: "Verify financial transactions",
    api: "/api/wallet/balance + /api/wallet/transactions",
    method: "GET",
    status: finalShipperWallet.status,
    pass:
      finalShipperWallet.status === 200 && finalCarrierWallet.status === 200,
    data: {
      shipper: {
        initialBalance: initialShipperBalance,
        finalBalance: finalShipperBalance,
        balanceChange:
          typeof finalShipperBalance === "number" &&
          typeof initialShipperBalance === "number"
            ? finalShipperBalance - initialShipperBalance
            : "N/A",
        wallets: finalShipperWallet.data?.wallets?.map((w: any) => ({
          type: w.type,
          balance: w.balance,
        })),
        recentTransactions: shipperTxns.data?.transactions
          ?.slice(0, 3)
          ?.map((t: any) => ({
            type: t.type,
            amount: t.amount,
            description: t.description?.slice(0, 60),
          })),
      },
      carrier: {
        initialBalance: initialCarrierBalance,
        finalBalance: finalCarrierBalance,
        balanceChange:
          typeof finalCarrierBalance === "number" &&
          typeof initialCarrierBalance === "number"
            ? finalCarrierBalance - initialCarrierBalance
            : "N/A",
        wallets: finalCarrierWallet.data?.wallets?.map((w: any) => ({
          type: w.type,
          balance: w.balance,
        })),
        recentTransactions: carrierTxns.data?.transactions
          ?.slice(0, 3)
          ?.map((t: any) => ({
            type: t.type,
            amount: t.amount,
            description: t.description?.slice(0, 60),
          })),
      },
    },
  });

  // ─── Step 15: Final state verification ──────────────────────────────────

  const [finalLoad, finalTrip] = await Promise.all([
    apiCall("GET", `/api/loads/${loadId}`, admin),
    apiCall("GET", `/api/trips/${tripId}`, admin),
  ]);

  const loadStatus = finalLoad.data?.load?.status || finalLoad.data?.status;
  const tripStatus = finalTrip.data?.trip?.status;

  record({
    step: 15,
    name: "Final state verification",
    api: `/api/loads/${loadId} + /api/trips/${tripId}`,
    method: "GET",
    status: finalLoad.status,
    pass: loadStatus === "COMPLETED" && tripStatus === "COMPLETED",
    data: {
      loadId,
      loadStatus,
      tripId,
      tripStatus,
      allCompleted: loadStatus === "COMPLETED" && tripStatus === "COMPLETED",
    },
    error:
      loadStatus !== "COMPLETED"
        ? `Load status is ${loadStatus}, expected COMPLETED`
        : tripStatus !== "COMPLETED"
          ? `Trip status is ${tripStatus}, expected COMPLETED`
          : undefined,
  });

  // Print summary
  printSummary();
}

function printSummary() {
  console.log("\n");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("  TEST SUMMARY");
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.pass ? "✅" : "❌";
    console.log(`  ${icon} Step ${r.step}: ${r.name}`);
  }

  console.log("");
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log("");

  if (failed === 0) {
    console.log("  🎉 ALL TESTS PASSED!");
  } else {
    console.log(`  ⚠️  ${failed} test(s) failed.`);
  }

  console.log(
    "═══════════════════════════════════════════════════════════════"
  );

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\n💥 UNHANDLED ERROR:", err);
  process.exit(1);
});
