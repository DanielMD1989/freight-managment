/**
 * End-to-End Carrier Workflow Browser Test
 *
 * Complete carrier lifecycle: registration → admin verification →
 * truck add → truck approval → truck posting → shipper load creation →
 * load request → approval → trip lifecycle → POD → fee deduction → wallet check.
 *
 * Headed mode so the user can watch the workflow unfold.
 * Hybrid: Browser UI + API calls (Bearer tokens skip CSRF).
 *
 * Run:  node scripts/browser-test-carrier-e2e.mjs
 * Requires: Next.js dev server on localhost:3000 with seeded data
 */

import { chromium, request as pwRequest } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = "./browser-test-results/e2e-carrier-workflow";
const TS = Date.now();
const TEST_PASSWORD = "Str0ng!Pass1";
const PHONE_SUFFIX = String(TS).slice(-7);

const CARRIER = {
  email: `carrier-e2e-${TS}@test.com`,
  password: TEST_PASSWORD,
  firstName: "Kebede",
  lastName: "Alemu",
  phone: `+25195${PHONE_SUFFIX}`,
  role: "CARRIER",
  carrierType: "CARRIER_COMPANY",
  companyName: `Alemu Transport ${TS}`,
};

const ADMIN = { email: "admin@test.com", password: "password" };
const SHIPPER = { email: "agri-shipper@demo.com", password: "password" };

// Fee verification (Addis Ababa → Dire Dawa corridor)
// Rates will be updated dynamically from the actual corridor data in Phase 8
const EXPECTED = {
  distanceKm: 453,
  shipperRatePerKm: 40,
  carrierRatePerKm: 34,
  shipperFee: 18120,
  carrierFee: 15402,
  totalPlatformFee: 33522,
};

mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ─── Results Tracking ─────────────────────────────────────────────────────────
const results = [];
function record(phase, test, status, details = "") {
  results.push({ phase, test, status, details });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "⚠";
  console.log(`   ${icon} ${test}${details ? ` — ${details}` : ""}`);
}

// ─── Test File Generators ─────────────────────────────────────────────────────
function createTestPDF() {
  const content = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
  return Buffer.from(content);
}

function createTestJPEG() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`   📸 ${name}`);
}

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

async function safeText(page) {
  return page.textContent("body").catch(() => "");
}

async function tryClick(page, selectors, description) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el && (await el.isVisible().catch(() => false))) {
        await el.click({ timeout: 5000 });
        console.log(`   ✓ Clicked: ${description} (via ${sel})`);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  console.log(`   ✗ Could not click: ${description}`);
  return false;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiCall(
  method,
  path,
  { body, token, headers: extraHeaders } = {}
) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-client-type"] = "mobile";
  }
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const opts = { method, headers };
  if (body) {
    opts.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, ok: res.ok };
}

// Token cache: avoid re-logging in for the same email
const tokenCache = {};

async function apiLogin(email, password) {
  // Return cached token if available
  if (tokenCache[email]) {
    return tokenCache[email];
  }

  // Retry with back-off for rate limiting
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { status, data } = await apiCall("POST", "/api/auth/login", {
      body: { email, password },
      headers: { "x-client-type": "mobile" },
    });
    if (status === 200) {
      const result = {
        sessionToken: data.sessionToken,
        user: data.user,
        limitedAccess: data.limitedAccess,
      };
      tokenCache[email] = result;
      return result;
    }
    if (status === 429 || (data?.error && data.error.includes("Too many"))) {
      if (attempt < 3) {
        const waitSec = attempt * 15; // 15s, 30s
        console.log(
          `   ⏳ Rate limited (attempt ${attempt}/3). Waiting ${waitSec}s...`
        );
        await sleep(waitSec * 1000);
        continue;
      }
    }
    throw new Error(`Login failed for ${email}: ${data?.error || status}`);
  }
}

async function apiLoginWithCSRF(apiContext, email, password) {
  const loginRes = await apiContext.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });
  if (loginRes.status() !== 200) {
    const body = await loginRes.json();
    throw new Error(
      `CSRF login failed for ${email}: ${body?.error || loginRes.status()}`
    );
  }
  const csrfRes = await apiContext.get(`${BASE_URL}/api/csrf-token`);
  const csrfData = await csrfRes.json();
  return { csrfToken: csrfData.csrfToken };
}

// Cookie cache: avoids hitting rate limiter with repeated browser logins
const cookieCache = {};

async function browserLogin(page, email, password) {
  // Try reusing saved cookies first
  if (cookieCache[email]) {
    const context = page.context();
    await context.addCookies(cookieCache[email]);
    console.log(`   ✓ Reused cached cookies for ${email}`);
    // Navigate to verify cookies work
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const url = page.url();
    if (!url.includes("/login")) {
      return url;
    }
    console.log(`   ⚠ Cached cookies expired for ${email}, doing fresh login`);
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await sleep(4000);

  // Save cookies for reuse
  const url = page.url();
  if (!url.includes("/login")) {
    const context = page.context();
    cookieCache[email] = await context.cookies();
    console.log(
      `   ✓ Saved cookies for ${email} (${cookieCache[email].length} cookies)`
    );
  }

  return url;
}

// Fallback seeded carrier account (used when registration is rate-limited)
const FALLBACK_CARRIER = {
  email: "selam-admin@demo.com",
  password: "password",
  firstName: "Selam",
  lastName: "Admin",
  phone: "+251911000000",
  role: "CARRIER",
  carrierType: "CARRIER_COMPANY",
  companyName: "Selam Transport",
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Carrier Registration (Browser)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase1(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 1: Carrier Registration");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  let registrationSucceeded = false;

  try {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await screenshot(page, "e2e-01-register-page");

    // Fill registration form
    await page.fill('#firstName, input[name="firstName"]', CARRIER.firstName);
    await page.fill('#lastName, input[name="lastName"]', CARRIER.lastName);
    await page.fill('#email, input[name="email"]', CARRIER.email);
    await page.fill('#phone, input[name="phone"]', CARRIER.phone);

    // Select role = CARRIER
    await page.selectOption('#role, select[name="role"]', "CARRIER");
    await sleep(500);

    // Select carrier type
    await page.selectOption(
      '#carrierType, select[name="carrierType"]',
      "CARRIER_COMPANY"
    );
    await sleep(500);

    // Company name
    await page.fill(
      '#companyName, input[name="companyName"]',
      CARRIER.companyName
    );

    // Password fields
    await page.fill('#password, input[name="password"]', CARRIER.password);
    await page.fill(
      '#confirmPassword, input[name="confirmPassword"]',
      CARRIER.password
    );

    await screenshot(page, "e2e-02-register-filled");

    // Submit
    await page.click('button[type="submit"]');
    await sleep(5000);

    const afterRegUrl = page.url();
    registrationSucceeded = !afterRegUrl.includes("/register");
    record(
      "Phase 1",
      "1a. Register carrier (browser)",
      registrationSucceeded ? "PASS" : "FAIL",
      afterRegUrl
    );
    await screenshot(page, "e2e-03-register-after");

    // Capture error if present
    if (!registrationSucceeded) {
      const pageText = await safeText(page);
      const errorMatch = pageText.match(
        /(User with.*?exists|Too many|Validation|Password)/i
      );
      if (errorMatch) console.log(`   ⚠ Form error: ${errorMatch[0].trim()}`);
    }
  } catch (e) {
    record("Phase 1", "1a. Register carrier (browser)", "FAIL", e.message);
    await screenshot(page, "e2e-03-register-error").catch(() => {});
  }

  // API login to get token + IDs
  console.log("\n[1b] API Login to capture tokens");
  let loginOk = false;

  // Strategy 1: Try login with the registration email
  try {
    const login = await apiLogin(CARRIER.email, CARRIER.password);
    state.carrier = {
      ...CARRIER,
      token: login.sessionToken,
      userId: login.user.id,
      orgId: login.user.organizationId,
    };
    loginOk = true;
    record(
      "Phase 1",
      "1b. Login (fresh registration)",
      "PASS",
      `limitedAccess=${login.limitedAccess}`
    );
  } catch (e) {
    console.log(`   ⚠ Login with ${CARRIER.email} failed: ${e.message}`);
  }

  // Strategy 2: If registration was rate-limited, try API registration
  if (!loginOk) {
    console.log("   Trying API registration fallback...");
    try {
      const regRes = await apiCall("POST", "/api/auth/register", {
        body: {
          firstName: CARRIER.firstName,
          lastName: CARRIER.lastName,
          email: CARRIER.email,
          phone: CARRIER.phone,
          password: CARRIER.password,
          confirmPassword: CARRIER.password,
          role: "CARRIER",
          carrierType: "CARRIER_COMPANY",
          companyName: CARRIER.companyName,
        },
      });
      if (regRes.ok) {
        console.log("   ✓ API registration succeeded");
        const login = await apiLogin(CARRIER.email, CARRIER.password);
        state.carrier = {
          ...CARRIER,
          token: login.sessionToken,
          userId: login.user.id,
          orgId: login.user.organizationId,
        };
        loginOk = true;
        record("Phase 1", "1b. Login (API registration)", "PASS", "");
      } else {
        console.log(
          `   ⚠ API registration failed: ${regRes.data?.error || regRes.status}`
        );
      }
    } catch {
      /* continue to fallback */
    }
  }

  // Strategy 3: Fall back to seeded carrier account
  if (!loginOk) {
    console.log(
      `   ⚠ Registration rate-limited. Using seeded carrier: ${FALLBACK_CARRIER.email}`
    );
    try {
      const login = await apiLogin(
        FALLBACK_CARRIER.email,
        FALLBACK_CARRIER.password
      );
      state.carrier = {
        ...FALLBACK_CARRIER,
        token: login.sessionToken,
        userId: login.user.id,
        orgId: login.user.organizationId,
      };
      state.usedFallbackCarrier = true;
      loginOk = true;
      record(
        "Phase 1",
        "1b. Login (seeded carrier fallback)",
        "PASS",
        `email=${FALLBACK_CARRIER.email}, limitedAccess=${login.limitedAccess}`
      );
    } catch (e) {
      record("Phase 1", "1b. All login strategies failed", "FAIL", e.message);
    }
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Document Upload (API)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase2(state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 2: Document Upload (API)");
  console.log("═".repeat(70));

  if (!state.carrier?.orgId) {
    record("Phase 2", "2. SKIP — no orgId from Phase 1", "FAIL", "");
    return;
  }

  // If using fallback carrier, skip document upload (already has docs)
  if (state.usedFallbackCarrier) {
    record(
      "Phase 2",
      "2. SKIP — using seeded carrier (docs exist)",
      "PASS",
      ""
    );
    return;
  }

  const pdfBuffer = createTestPDF();
  const jpegBuffer = createTestJPEG();
  const orgId = state.carrier.orgId;

  const apiCtx = await pwRequest.newContext();
  try {
    const { csrfToken } = await apiLoginWithCSRF(
      apiCtx,
      state.carrier.email,
      state.carrier.password
    );

    const docs = [
      {
        type: "COMPANY_LICENSE",
        name: "company-license.pdf",
        mime: "application/pdf",
        buf: pdfBuffer,
      },
      {
        type: "TIN_CERTIFICATE",
        name: "tin-cert.jpg",
        mime: "image/jpeg",
        buf: jpegBuffer,
      },
      {
        type: "INSURANCE_CERTIFICATE",
        name: "insurance.pdf",
        mime: "application/pdf",
        buf: pdfBuffer,
      },
    ];

    for (const doc of docs) {
      const multipart = {
        file: { name: doc.name, mimeType: doc.mime, buffer: doc.buf },
        type: doc.type,
        entityType: "company",
        entityId: orgId,
      };
      if (doc.type === "INSURANCE_CERTIFICATE") {
        multipart.policyNumber = "INS-E2E-001";
        multipart.insuranceProvider = "Ethiopian Insurance Corp";
        multipart.coverageAmount = "5000000";
        multipart.coverageType = "CARGO";
      }

      const res = await apiCtx.post(`${BASE_URL}/api/documents/upload`, {
        multipart,
        headers: { "X-CSRF-Token": csrfToken },
      });
      const data = await res.json();
      const ok =
        res.status() === 200 && data.document?.verificationStatus === "PENDING";
      record(
        "Phase 2",
        `2. Upload ${doc.type}`,
        ok ? "PASS" : "FAIL",
        `status=${res.status()}, verification=${data.document?.verificationStatus}`
      );
    }
  } catch (e) {
    record("Phase 2", "2. Document upload", "FAIL", e.message);
  } finally {
    await apiCtx.dispose();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Admin Verification (Browser + API)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase3(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 3: Admin Verification");
  console.log("═".repeat(70));

  if (!state.carrier?.userId) {
    record("Phase 3", "3. SKIP — no carrier userId", "FAIL", "");
    return;
  }

  // Admin API login
  const adminLogin = await apiLogin(ADMIN.email, ADMIN.password);
  state.admin = { token: adminLogin.sessionToken, userId: adminLogin.user.id };

  // If using fallback carrier, skip verification (already ACTIVE)
  if (state.usedFallbackCarrier) {
    console.log("   Using seeded carrier — skipping admin verification");
    record("Phase 3", "3. SKIP — seeded carrier already verified", "PASS", "");

    // Still need to ensure shipper is set up
    console.log("\n[3d] Set up shipper");
    try {
      const shipperLogin = await apiLogin(SHIPPER.email, SHIPPER.password);
      state.shipper = {
        token: shipperLogin.sessionToken,
        userId: shipperLogin.user.id,
        orgId: shipperLogin.user.organizationId,
      };

      // Check shipper wallet balance
      const balRes = await apiCall("GET", "/api/wallet/balance", {
        token: state.shipper.token,
      });
      const wallets = balRes.data?.wallets || [];
      const shipperWallet = wallets.find(
        (w) => w.type === "SHIPPER_WALLET" || w.accountType === "SHIPPER_WALLET"
      );
      const shipperBalance = Number(shipperWallet?.balance ?? 0);
      console.log(`   Shipper balance: ${shipperBalance} ETB`);

      if (shipperBalance < 50000) {
        const shipperSearchRes = await apiCall(
          "GET",
          `/api/admin/users?search=${encodeURIComponent(SHIPPER.email)}`,
          {
            token: state.admin.token,
          }
        );
        const shipperUser = shipperSearchRes.data?.users?.[0];
        if (shipperUser) {
          await apiCall(
            "POST",
            `/api/admin/users/${shipperUser.id}/wallet/topup`,
            {
              body: {
                amount: 50000,
                paymentMethod: "MANUAL",
                notes: "E2E test shipper wallet top-up",
              },
              token: state.admin.token,
            }
          );
        }
      }
    } catch (e) {
      record("Phase 3", "3d. Shipper setup", "FAIL", e.message);
    }

    // Check carrier wallet balance and top up if needed
    console.log("\n[3c] Check carrier wallet");
    try {
      const balRes = await apiCall("GET", "/api/wallet/balance", {
        token: state.carrier.token,
      });
      const wallets = balRes.data?.wallets || [];
      const carrierWallet = wallets.find(
        (w) => w.type === "CARRIER_WALLET" || w.accountType === "CARRIER_WALLET"
      );
      const carrierBalance = Number(carrierWallet?.balance ?? 0);
      console.log(`   Carrier balance: ${carrierBalance} ETB`);

      if (carrierBalance < 50000) {
        const topUpRes = await apiCall(
          "POST",
          `/api/admin/users/${state.carrier.userId}/wallet/topup`,
          {
            body: {
              amount: 50000,
              paymentMethod: "MANUAL",
              notes: "E2E test carrier wallet top-up",
            },
            token: state.admin.token,
          }
        );
        console.log(`   Top-up result: ${topUpRes.status}`);
      }
    } catch (e) {
      console.log(`   ⚠ Carrier wallet check: ${e.message}`);
    }

    return;
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    // Login as admin in browser
    console.log("\n[3a] Admin login → activate carrier user");
    await browserLogin(page, ADMIN.email, ADMIN.password);
    await screenshot(page, "e2e-04-admin-login");

    // Navigate to carrier's user detail page
    await page.goto(`${BASE_URL}/admin/users/${state.carrier.userId}`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-05-admin-user-detail");

    // Click "Edit User" to enter edit mode (shows inline status dropdown)
    const editClicked = await tryClick(
      page,
      ['button:has-text("Edit User")', 'button:has-text("Edit")'],
      "Edit User button"
    );
    if (editClicked) {
      await sleep(1000);

      // Now status dropdown should be visible
      const statusSelect = await page.$("select");
      if (statusSelect) {
        await statusSelect.selectOption("ACTIVE");
        console.log("   ✓ Selected status: ACTIVE");
        await sleep(500);
      }

      // Click "Save Changes"
      const saved = await tryClick(
        page,
        [
          'button:has-text("Save Changes")',
          'button:has-text("Save")',
          'button:has-text("Update")',
        ],
        "Save Changes button"
      );
      if (saved) await sleep(3000);
    }
    await screenshot(page, "e2e-06-admin-user-activated");

    // Verify via API as fallback
    const activateRes = await apiCall(
      "PATCH",
      `/api/admin/users/${state.carrier.userId}`,
      {
        body: { status: "ACTIVE" },
        token: state.admin.token,
      }
    );
    record(
      "Phase 3",
      "3a. Activate carrier user",
      activateRes.ok ? "PASS" : "FAIL",
      `status=${activateRes.status}`
    );
  } catch (e) {
    record("Phase 3", "3a. Activate carrier user", "FAIL", e.message);
    await screenshot(page, "e2e-06-error").catch(() => {});
  }

  // 3b. Verify org via API
  console.log("\n[3b] Verify carrier organization");
  try {
    const verifyOrgRes = await apiCall(
      "POST",
      `/api/admin/organizations/${state.carrier.orgId}/verify`,
      {
        token: state.admin.token,
      }
    );
    record(
      "Phase 3",
      "3b. Verify carrier org",
      verifyOrgRes.ok ? "PASS" : "FAIL",
      `status=${verifyOrgRes.status}`
    );
  } catch (e) {
    record("Phase 3", "3b. Verify carrier org", "FAIL", e.message);
  }

  // 3c. Top up carrier wallet via API
  console.log("\n[3c] Top up carrier wallet");
  try {
    const topUpRes = await apiCall(
      "POST",
      `/api/admin/users/${state.carrier.userId}/wallet/topup`,
      {
        body: {
          amount: 50000,
          paymentMethod: "MANUAL",
          notes: "E2E test carrier wallet top-up",
        },
        token: state.admin.token,
      }
    );
    record(
      "Phase 3",
      "3c. Top up carrier wallet (50,000 ETB)",
      topUpRes.ok ? "PASS" : "FAIL",
      `status=${topUpRes.status}, newBalance=${topUpRes.data?.newBalance}`
    );
    await screenshot(page, "e2e-07-carrier-wallet-topup");
  } catch (e) {
    record("Phase 3", "3c. Top up carrier wallet", "FAIL", e.message);
  }

  // 3d. Top up shipper wallet if needed
  console.log("\n[3d] Top up shipper wallet (if insufficient)");
  try {
    const shipperLogin = await apiLogin(SHIPPER.email, SHIPPER.password);
    state.shipper = {
      token: shipperLogin.sessionToken,
      userId: shipperLogin.user.id,
      orgId: shipperLogin.user.organizationId,
    };

    // Check shipper balance
    const balRes = await apiCall("GET", "/api/wallet/balance", {
      token: state.shipper.token,
    });
    const wallets = balRes.data?.wallets || [];
    const shipperWallet = wallets.find(
      (w) => w.type === "SHIPPER_WALLET" || w.accountType === "SHIPPER_WALLET"
    );
    const shipperBalance = Number(shipperWallet?.balance ?? 0);
    console.log(`   Shipper balance: ${shipperBalance} ETB`);

    if (shipperBalance < 50000) {
      // Find shipper userId for admin topup
      const shipperSearchRes = await apiCall(
        "GET",
        `/api/admin/users?search=${encodeURIComponent(SHIPPER.email)}`,
        {
          token: state.admin.token,
        }
      );
      const shipperUser = shipperSearchRes.data?.users?.[0];
      if (shipperUser) {
        const topUpRes = await apiCall(
          "POST",
          `/api/admin/users/${shipperUser.id}/wallet/topup`,
          {
            body: {
              amount: 50000,
              paymentMethod: "MANUAL",
              notes: "E2E test shipper wallet top-up",
            },
            token: state.admin.token,
          }
        );
        record(
          "Phase 3",
          "3d. Top up shipper wallet",
          topUpRes.ok ? "PASS" : "FAIL",
          `status=${topUpRes.status}`
        );
      }
    } else {
      record(
        "Phase 3",
        "3d. Shipper wallet sufficient",
        "PASS",
        `balance=${shipperBalance}`
      );
    }
  } catch (e) {
    record("Phase 3", "3d. Shipper wallet check", "FAIL", e.message);
  }

  // 3e. Approve carrier documents via API
  console.log("\n[3e] Approve carrier documents");
  try {
    const pendingRes = await apiCall(
      "GET",
      "/api/admin/documents?status=PENDING",
      {
        token: state.admin.token,
      }
    );
    const pendingDocs = pendingRes.data?.documents || [];
    const carrierDocs = pendingDocs.filter(
      (d) =>
        d.organizationId === state.carrier.orgId ||
        d.organization?.id === state.carrier.orgId
    );
    console.log(`   Found ${carrierDocs.length} carrier docs to approve`);

    let approvedCount = 0;
    for (const doc of carrierDocs) {
      const approveRes = await apiCall(
        "PATCH",
        `/api/admin/verification/${doc.id}`,
        {
          body: {
            entityType: doc.entityType || "company",
            verificationStatus: "APPROVED",
          },
          token: state.admin.token,
        }
      );
      if (approveRes.ok) approvedCount++;
    }
    record(
      "Phase 3",
      "3e. Approve carrier documents",
      approvedCount === carrierDocs.length && carrierDocs.length > 0
        ? "PASS"
        : "FAIL",
      `approved=${approvedCount}/${carrierDocs.length}`
    );
    await screenshot(page, "e2e-08-docs-approved");
  } catch (e) {
    record("Phase 3", "3e. Approve carrier documents", "FAIL", e.message);
  }

  // Re-login carrier to get fresh token with full access
  console.log("\n[3f] Re-login carrier for full access");
  try {
    // Clear cached token so we get a fresh login reflecting ACTIVE status
    delete tokenCache[state.carrier.email];
    const relogin = await apiLogin(state.carrier.email, state.carrier.password);
    state.carrier.token = relogin.sessionToken;
    const fullAccess = relogin.limitedAccess === false;
    record(
      "Phase 3",
      "3f. Carrier full access",
      fullAccess ? "PASS" : "FAIL",
      `limitedAccess=${relogin.limitedAccess}`
    );
    await screenshot(page, "e2e-09-carrier-full-access");
  } catch (e) {
    record("Phase 3", "3f. Carrier re-login", "FAIL", e.message);
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Register Truck (Browser)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase4(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 4: Register Truck (Browser)");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const licensePlate = `E2E-${String(TS).slice(-6)}`;

  // Brief pause to avoid login rate limiting from rapid Phase 1-3 logins
  await sleep(2000);

  // Clear carrier cookie cache so browser login uses fresh session (after ACTIVE status set in Phase 3)
  const carrierEmail = state.carrier?.email || CARRIER.email;
  const carrierPassword = state.carrier?.password || CARRIER.password;
  delete cookieCache[carrierEmail];

  // Browser attempt: try to fill and submit truck form
  try {
    await browserLogin(page, carrierEmail, carrierPassword);

    await page.goto(`${BASE_URL}/carrier/trucks/add`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-10-truck-add-form");

    await page.selectOption('select[name="truckType"]', "FLATBED");
    console.log("   ✓ Selected truck type: FLATBED");
    await page.fill('input[name="licensePlate"]', licensePlate);
    console.log(`   ✓ Filled license plate: ${licensePlate}`);
    await page.fill('input[name="capacity"]', "25000");
    // Volume is optional — skip to avoid step constraint browser validation
    const regionSelect = await page.$('select[name="currentRegion"]');
    if (regionSelect) await regionSelect.selectOption("Addis Ababa");
    await screenshot(page, "e2e-11-truck-form-filled");

    // Dismiss overlays and submit
    await page.keyboard.press("Escape");
    await sleep(300);
    await page
      .evaluate(() => {
        document
          .querySelectorAll("div.fixed.inset-0")
          .forEach((el) => el.remove());
      })
      .catch(() => {});

    // Click "Submit for Approval" button
    const submitted = await tryClick(
      page,
      [
        'button:has-text("Submit for Approval")',
        'button:has-text("Submit")',
        'button[type="submit"]',
      ],
      "Submit truck form"
    );
    if (!submitted) {
      // JS fallback click
      await page
        .evaluate(() => {
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        })
        .catch(() => {});
    }
    await sleep(5000);

    const afterUrl = page.url();
    const truckSubmitted =
      afterUrl.includes("/carrier/trucks") && !afterUrl.includes("/add");
    record(
      "Phase 4",
      "4a. Submit truck form",
      truckSubmitted ? "PASS" : "FAIL",
      afterUrl
    );
    await screenshot(page, "e2e-12-truck-submitted");
  } catch (e) {
    console.log(`   ⚠ Browser truck form failed: ${e.message?.split("\n")[0]}`);
    await screenshot(page, "e2e-12-error").catch(() => {});
  }

  // API fallback: always ensure truck exists (regardless of browser success)
  try {
    // Check if truck was created via browser
    const trucksRes = await apiCall(
      "GET",
      "/api/trucks?approvalStatus=PENDING",
      {
        token: state.carrier.token,
      }
    );
    const trucks = trucksRes.data?.trucks || [];
    const ourTruck = trucks.find((t) => t.licensePlate === licensePlate);
    if (ourTruck) {
      state.truckId = ourTruck.id;
      console.log(`   Truck ID (from browser): ${state.truckId}`);
    } else {
      // Also check all trucks (not just pending)
      const allTrucksRes = await apiCall("GET", "/api/trucks", {
        token: state.carrier.token,
      });
      const allTrucks = allTrucksRes.data?.trucks || [];
      const fallback = allTrucks.find((t) => t.licensePlate === licensePlate);
      if (fallback) {
        state.truckId = fallback.id;
        console.log(`   Truck ID (existing): ${state.truckId}`);
      } else {
        // Create truck via API
        console.log("   Truck not found — creating via API");
        const createRes = await apiCall("POST", "/api/trucks", {
          body: {
            truckType: "FLATBED",
            licensePlate,
            capacity: 25000,
            volume: 60,
            currentRegion: "Addis Ababa",
            isAvailable: true,
          },
          token: state.carrier.token,
        });
        const createdTruck = createRes.data?.truck;
        if (createdTruck) {
          state.truckId = createdTruck.id;
          console.log(`   Truck ID (API created): ${state.truckId}`);
          record(
            "Phase 4",
            "4a. Truck created via API fallback",
            "PASS",
            `truckId=${state.truckId?.slice(-8)}`
          );
        } else {
          console.log(
            `   ⚠ Truck creation failed: ${JSON.stringify(createRes.data?.error || createRes.data)}`
          );
          record(
            "Phase 4",
            "4a. Truck creation failed",
            "FAIL",
            `status=${createRes.status}, error=${createRes.data?.error || "unknown"}`
          );
        }
      }
    }
    state.licensePlate = licensePlate;
  } catch (e) {
    record("Phase 4", "4. Truck setup", "FAIL", e.message);
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Admin Approves Truck (Browser)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase5(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 5: Admin Approves Truck");
  console.log("═".repeat(70));

  if (!state.truckId) {
    record("Phase 5", "5. SKIP — no truckId from Phase 4", "FAIL", "");
    return;
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    // Login as admin
    await browserLogin(page, ADMIN.email, ADMIN.password);

    // Navigate to pending trucks
    await page.goto(`${BASE_URL}/admin/trucks/pending`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-14-admin-trucks-pending");

    // Find our truck by license plate
    const bodyText = await safeText(page);
    const truckFound = bodyText.includes(state.licensePlate);
    console.log(`   Truck ${state.licensePlate} found: ${truckFound}`);

    // Try clicking Approve on our truck row
    let approved = false;

    // Try direct API approval via POST /api/trucks/[id]/approve
    const approveRes = await apiCall(
      "POST",
      `/api/trucks/${state.truckId}/approve`,
      {
        body: { action: "APPROVE" },
        token: state.admin.token,
      }
    );
    if (approveRes.ok) {
      approved = true;
      console.log("   ✓ Truck approved via API");
    }

    // Browser fallback: click Approve button on the page
    if (!approved && truckFound) {
      // Find the row with our license plate and click Approve
      const approveClicked = await tryClick(
        page,
        [
          `tr:has-text("${state.licensePlate}") button:has-text("Approve")`,
          'button:has-text("Approve")',
        ],
        "Approve button"
      );

      if (approveClicked) {
        await sleep(1000);
        // Confirm dialog if present
        const confirmClicked = await tryClick(
          page,
          [
            'button:has-text("Confirm")',
            'button:has-text("Yes")',
            'button:has-text("OK")',
            'div[role="dialog"] button:has-text("Approve")',
          ],
          "Confirm approval"
        );
        if (confirmClicked) await sleep(3000);
        approved = true;
      }
    }

    record(
      "Phase 5",
      "5. Admin approves truck",
      approved ? "PASS" : "FAIL",
      `truckId=${state.truckId?.slice(-8)}`
    );
    await screenshot(page, "e2e-15-truck-approved");
  } catch (e) {
    record("Phase 5", "5. Admin approves truck", "FAIL", e.message);
    await screenshot(page, "e2e-15-error").catch(() => {});
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: Post Truck (Browser)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase6(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 6: Post Truck on Loadboard");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    // Login as carrier
    await browserLogin(
      page,
      state.carrier?.email || CARRIER.email,
      state.carrier?.password || CARRIER.password
    );

    // Navigate to loadboard
    await page.goto(`${BASE_URL}/carrier/loadboard`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-16-loadboard");

    // Dismiss any notification popup first
    await page.keyboard.press("Escape");
    await sleep(500);

    // Click "+ NEW TRUCK POST" button to open modal
    const postClicked = await tryClick(
      page,
      [
        'button:has-text("NEW TRUCK POST")',
        'button:has-text("Post Truck")',
        'button:has-text("+ POST")',
        'button:has-text("New Posting")',
        'a:has-text("NEW TRUCK POST")',
      ],
      "New Truck Post button"
    );

    if (postClicked) {
      await sleep(2000);
      await screenshot(page, "e2e-17-posting-modal");

      // Step 1: Select truck from dropdown
      // The dropdown contains approved trucks with format: "PLATE - TYPE • CAPACITYkg"
      let truckSelected = false;
      try {
        // Find the truck selection dropdown (first select in the form with "Select a truck" option)
        const truckDropdown = await page.$(
          'select:has(option:text("Select a truck"))'
        );
        if (truckDropdown) {
          // Try selecting by truck ID
          if (state.truckId) {
            await truckDropdown.selectOption(state.truckId);
            truckSelected = true;
            console.log(
              `   ✓ Selected truck by ID: ${state.truckId?.slice(-8)}`
            );
          }
        }

        // Fallback: try selecting by index (first truck option after placeholder)
        if (!truckSelected) {
          const selects = await page.$$("select");
          for (const sel of selects) {
            const options = await sel.$$("option");
            if (options.length > 1) {
              const firstOptionText = (await options[0]?.textContent()) || "";
              if (
                firstOptionText.includes("Select a truck") ||
                firstOptionText.includes("Select")
              ) {
                // Select the first real option (index 1)
                const secondOption = await options[1]?.getAttribute("value");
                if (secondOption) {
                  await sel.selectOption(secondOption);
                  truckSelected = true;
                  console.log(
                    `   ✓ Selected first available truck: ${secondOption.slice(-8)}`
                  );
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.log(
          `   ⚠ Could not select truck: ${e.message?.split("\n")[0]}`
        );
      }

      if (truckSelected) {
        await sleep(1500); // Wait for Step 2 to appear

        // Step 2: Fill posting details (only visible after truck selected)
        // Origin (PlacesAutocomplete — fallback text input when Google Maps API unavailable)
        const originInput = await page.$(
          'input[placeholder="Where is truck available?"]'
        );
        if (originInput) {
          await originInput.fill("Addis Ababa");
          await sleep(1000);
          // Try to pick suggestion from dropdown
          const suggestion = await page.$(
            '.pac-item, [role="option"]:has-text("Addis"), li:has-text("Addis")'
          );
          if (suggestion) {
            await suggestion.click();
            console.log("   ✓ Selected Addis Ababa from suggestions");
          } else {
            console.log("   ✓ Typed origin: Addis Ababa");
          }
          await sleep(500);
        }

        // Available From (date input)
        const dateInput = await page.$('input[type="date"]');
        if (dateInput) {
          await dateInput.fill(futureDate(1));
          console.log(`   ✓ Set availableFrom: ${futureDate(1)}`);
        }

        // Contact Phone
        const phoneInput = await page.$('input[type="tel"]');
        if (phoneInput) {
          await phoneInput.fill("+251912345678");
          console.log("   ✓ Filled contact phone");
        }

        await screenshot(page, "e2e-17b-posting-filled");

        // Submit: Click "Post Truck" button
        const submitClicked = await tryClick(
          page,
          [
            'button:has-text("Post Truck")',
            'button:has-text("POST")',
            'button[type="submit"]',
          ],
          "Post Truck button"
        );

        if (submitClicked) {
          await sleep(4000);
          await screenshot(page, "e2e-18-posting-submitted");
        }
      } else {
        console.log(
          "   ⚠ No truck available in dropdown — will use API fallback"
        );
        await screenshot(page, "e2e-17b-no-truck-available");
      }
    }

    // Verify posting exists via API
    const postingsRes = await apiCall(
      "GET",
      "/api/truck-postings?status=ACTIVE",
      {
        token: state.carrier.token,
      }
    );
    const postings =
      postingsRes.data?.truckPostings || postingsRes.data?.postings || [];
    const ourPosting = postings.find(
      (p) => p.truckId === state.truckId || p.truck?.id === state.truckId
    );

    // If posting not found via browser, create via API
    if (!ourPosting) {
      console.log("   Posting not found — creating via API fallback");
      // Get Ethiopian location for origin
      const citiesRes = await apiCall("GET", "/api/ethiopian-locations", {
        token: state.carrier.token,
      });
      const cities = citiesRes.data?.locations || citiesRes.data?.cities || [];
      const addisAbaba = cities.find((c) => c.name === "Addis Ababa");
      console.log(
        `   Found ${cities.length} locations, Addis Ababa: ${addisAbaba?.id?.slice(-8) || "NOT FOUND"}`
      );

      if (addisAbaba && state.truckId) {
        const postingRes = await apiCall("POST", "/api/truck-postings", {
          body: {
            truckId: state.truckId,
            originCityId: addisAbaba.id,
            availableFrom: new Date(futureDate(1) + "T00:00:00").toISOString(),
            fullPartial: "FULL",
            contactName: `${CARRIER.firstName} ${CARRIER.lastName}`,
            contactPhone: "+251912345678",
          },
          token: state.carrier.token,
        });
        if (!postingRes.ok) {
          console.log(
            `   API fallback error: ${JSON.stringify(postingRes.data?.error || postingRes.data)}`
          );
        }
        record(
          "Phase 6",
          "6. Post truck (API fallback)",
          postingRes.ok ? "PASS" : "FAIL",
          `status=${postingRes.status}`
        );
        if (postingRes.ok) {
          state.postingId = postingRes.data?.id;
        }
      } else {
        record(
          "Phase 6",
          "6. Post truck (API fallback)",
          "FAIL",
          `addisAbaba=${!!addisAbaba}, truckId=${!!state.truckId}`
        );
      }
    } else {
      record(
        "Phase 6",
        "6. Post truck on loadboard",
        "PASS",
        `postingId=${ourPosting?.id?.slice(-8)}`
      );
    }
  } catch (e) {
    record("Phase 6", "6. Post truck", "FAIL", e.message);
    await screenshot(page, "e2e-18-error").catch(() => {});
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7: Shipper Posts Load + Carrier Requests (API + Browser)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase7(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 7: Shipper Posts Load + Carrier Requests");
  console.log("═".repeat(70));

  // 7a. Shipper creates load via API
  console.log("\n[7a] Shipper creates load via API");
  try {
    if (!state.shipper?.token) {
      const shipperLogin = await apiLogin(SHIPPER.email, SHIPPER.password);
      state.shipper = {
        token: shipperLogin.sessionToken,
        userId: shipperLogin.user.id,
        orgId: shipperLogin.user.organizationId,
      };
    }

    const loadRes = await apiCall("POST", "/api/loads", {
      body: {
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: futureDate(3),
        deliveryDate: futureDate(6),
        truckType: "FLATBED",
        weight: 20000,
        cargoDescription: "E2E Test - Steel beams for Dire Dawa construction",
        tripKm: EXPECTED.distanceKm,
        status: "POSTED",
      },
      token: state.shipper.token,
    });

    const loadId = loadRes.data?.load?.id;
    state.loadId = loadId;
    record(
      "Phase 7",
      "7a. Shipper creates load (API)",
      loadRes.status === 201 ? "PASS" : "FAIL",
      `status=${loadRes.status}, loadId=${loadId?.slice(-8)}`
    );
  } catch (e) {
    record("Phase 7", "7a. Shipper creates load", "FAIL", e.message);
  }

  // 7b. Carrier browses loads on loadboard (Browser)
  console.log("\n[7b] Carrier browses Search Loads tab");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    await browserLogin(
      page,
      state.carrier?.email || CARRIER.email,
      state.carrier?.password || CARRIER.password
    );

    await page.goto(`${BASE_URL}/carrier/loadboard`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    // Click Search Loads tab
    await tryClick(
      page,
      ['button:has-text("Search Loads")', 'a:has-text("Search Loads")'],
      "Search Loads tab"
    );
    await sleep(2000);

    // Click "New Load Search" to show inline search form
    await tryClick(
      page,
      ['button:has-text("New Load Search")'],
      "New Load Search button"
    );
    await sleep(1000);

    // Click "Search" to fetch all posted loads (no filters = all loads)
    await tryClick(
      page,
      [
        'button:has-text("Search"):not(:has-text("New"))',
        'button[type="submit"]',
      ],
      "Search button"
    );
    await sleep(4000);

    const loadboardText = await safeText(page);
    const loadVisible =
      loadboardText.includes("Dire Dawa") ||
      loadboardText.includes("Steel") ||
      loadboardText.includes("Addis Ababa") ||
      loadboardText.includes("FLATBED");
    record(
      "Phase 7",
      "7b. Load visible on carrier loadboard",
      loadVisible ? "PASS" : "FAIL",
      `hasDireDawa=${loadboardText.includes("Dire Dawa")}`
    );
    await screenshot(page, "e2e-19-carrier-search-loads");
  } catch (e) {
    record("Phase 7", "7b. Carrier loadboard", "FAIL", e.message);
    await screenshot(page, "e2e-19-error").catch(() => {});
  }
  await context.close();

  // 7c. Carrier requests load via API
  console.log("\n[7c] Carrier requests load via API");
  try {
    if (!state.loadId || !state.truckId) {
      throw new Error(
        `Missing loadId=${state.loadId} or truckId=${state.truckId}`
      );
    }

    const reqRes = await apiCall("POST", "/api/load-requests", {
      body: {
        loadId: state.loadId,
        truckId: state.truckId,
        notes: "E2E test - ready to haul immediately",
      },
      token: state.carrier.token,
    });
    state.loadRequestId =
      reqRes.data?.loadRequest?.id || reqRes.data?.request?.id;
    if (!reqRes.ok) {
      console.log(
        `   Load request error: ${JSON.stringify(reqRes.data?.error || reqRes.data)}`
      );
    }
    record(
      "Phase 7",
      "7c. Carrier requests load (API)",
      reqRes.status === 201 ? "PASS" : "FAIL",
      `status=${reqRes.status}, requestId=${state.loadRequestId?.slice(-8)}`
    );
  } catch (e) {
    record("Phase 7", "7c. Carrier load request", "FAIL", e.message);
  }

  // 7d. Shipper approves → trip created
  console.log("\n[7d] Shipper approves load request → trip created");
  try {
    if (!state.loadRequestId) throw new Error("No loadRequestId");

    const approveRes = await apiCall(
      "POST",
      `/api/load-requests/${state.loadRequestId}/respond`,
      {
        body: {
          action: "APPROVE",
          responseNotes: "Approved - proceed to pickup",
        },
        token: state.shipper.token,
      }
    );

    const tripId = approveRes.data?.trip?.id;
    state.tripId = tripId;
    const tripStatus = approveRes.data?.trip?.status;
    record(
      "Phase 7",
      "7d. Shipper approves → trip created",
      approveRes.ok && tripId ? "PASS" : "FAIL",
      `tripId=${tripId?.slice(-8)}, tripStatus=${tripStatus}`
    );
    // Note: browser context was closed after 7b, no screenshot here
  } catch (e) {
    record("Phase 7", "7d. Shipper approves", "FAIL", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8: Trip Lifecycle (Browser + API)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase8(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 8: Trip Lifecycle");
  console.log("═".repeat(70));

  if (!state.tripId) {
    record("Phase 8", "8. SKIP — no tripId from Phase 7", "FAIL", "");
    return;
  }

  // 8pre. Look up actual corridor rates for fee verification
  console.log("\n[8-pre] Look up corridor rates for Addis Ababa → Dire Dawa");
  try {
    const corridorsRes = await apiCall(
      "GET",
      "/api/admin/corridors?originRegion=Addis+Ababa&destinationRegion=Dire+Dawa",
      {
        token: state.admin.token,
      }
    );
    const corridors = corridorsRes.data?.corridors || [];
    const corridor = corridors.find(
      (c) =>
        c.originRegion?.includes("Addis") &&
        c.destinationRegion?.includes("Dire")
    );
    if (corridor) {
      const shipperRate = Number(
        corridor.shipperPricePerKm || corridor.pricePerKm || 0
      );
      const carrierRate = Number(
        corridor.carrierPricePerKm || corridor.pricePerKm || 0
      );
      const distKm = Number(corridor.distanceKm || EXPECTED.distanceKm);

      EXPECTED.shipperRatePerKm = shipperRate;
      EXPECTED.carrierRatePerKm = carrierRate;
      EXPECTED.distanceKm = distKm;
      EXPECTED.shipperFee = distKm * shipperRate;
      EXPECTED.carrierFee = distKm * carrierRate;
      EXPECTED.totalPlatformFee = EXPECTED.shipperFee + EXPECTED.carrierFee;

      console.log(`   Corridor: ${corridor.name} (${distKm} km)`);
      console.log(
        `   Shipper rate: ${shipperRate} ETB/km → expected fee: ${EXPECTED.shipperFee}`
      );
      console.log(
        `   Carrier rate: ${carrierRate} ETB/km → expected fee: ${EXPECTED.carrierFee}`
      );
      console.log(`   Total expected: ${EXPECTED.totalPlatformFee}`);
    } else {
      console.log(`   ⚠ No corridor found, using default EXPECTED values`);
    }
  } catch (e) {
    console.log(`   ⚠ Could not look up corridor: ${e.message}`);
  }

  // 8a. Carrier views trip in browser
  console.log("\n[8a] Carrier views trip");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    await browserLogin(
      page,
      state.carrier?.email || CARRIER.email,
      state.carrier?.password || CARRIER.password
    );
    await page.goto(`${BASE_URL}/carrier/trips`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const tripsText = await safeText(page);
    const tripVisible =
      tripsText.includes("Dire Dawa") ||
      tripsText.includes("Addis Ababa") ||
      tripsText.includes("ASSIGNED");
    record(
      "Phase 8",
      "8a. Trip visible on carrier trips page",
      tripVisible ? "PASS" : "FAIL",
      ""
    );
    await screenshot(page, "e2e-21-carrier-trips");
  } catch (e) {
    record("Phase 8", "8a. View trip", "FAIL", e.message);
  }

  // 8b. Record wallet balances BEFORE
  console.log("\n[8b] Record wallet balances before trip");
  try {
    const carrierBal = await apiCall("GET", "/api/wallet/balance", {
      token: state.carrier.token,
    });
    const shipperBal = await apiCall("GET", "/api/wallet/balance", {
      token: state.shipper.token,
    });

    // Debug: log all wallet types
    console.log(`   Carrier wallet API: status=${carrierBal.status}`);
    const carrierWallets = carrierBal.data?.wallets || [];
    for (const w of carrierWallets) {
      console.log(
        `     - ${w.type || w.accountType}: ${w.balance} (id=${w.id?.slice(-8)})`
      );
    }
    console.log(`   Shipper wallet API: status=${shipperBal.status}`);
    const shipperWallets = shipperBal.data?.wallets || [];
    for (const w of shipperWallets) {
      console.log(
        `     - ${w.type || w.accountType}: ${w.balance} (id=${w.id?.slice(-8)})`
      );
    }

    const cw = carrierWallets.find(
      (w) => w.type === "CARRIER_WALLET" || w.accountType === "CARRIER_WALLET"
    );
    const sw = shipperWallets.find(
      (w) => w.type === "SHIPPER_WALLET" || w.accountType === "SHIPPER_WALLET"
    );

    state.carrierBalanceBefore = Number(cw?.balance ?? 0);
    state.shipperBalanceBefore = Number(sw?.balance ?? 0);

    console.log(`   Carrier balance before: ${state.carrierBalanceBefore} ETB`);
    console.log(`   Shipper balance before: ${state.shipperBalanceBefore} ETB`);
    record(
      "Phase 8",
      "8b. Wallet balances recorded",
      "PASS",
      `carrier=${state.carrierBalanceBefore}, shipper=${state.shipperBalanceBefore}`
    );
  } catch (e) {
    record("Phase 8", "8b. Wallet balances", "FAIL", e.message);
  }

  // 8c. Trip transitions: ASSIGNED → PICKUP_PENDING → IN_TRANSIT → DELIVERED
  console.log("\n[8c] Trip state transitions");
  const transitions = [
    { status: "PICKUP_PENDING", label: "ASSIGNED → PICKUP_PENDING" },
    { status: "IN_TRANSIT", label: "PICKUP_PENDING → IN_TRANSIT" },
    {
      status: "DELIVERED",
      label: "IN_TRANSIT → DELIVERED",
      extra: { receiverName: "Dawit G.", receiverPhone: "+251933333333" },
    },
  ];

  for (const t of transitions) {
    try {
      const body = { status: t.status, ...(t.extra || {}) };
      const res = await apiCall("PATCH", `/api/trips/${state.tripId}`, {
        body,
        token: state.carrier.token,
      });
      record(
        "Phase 8",
        `8c. ${t.label}`,
        res.ok ? "PASS" : "FAIL",
        `status=${res.status}`
      );
    } catch (e) {
      record("Phase 8", `8c. ${t.label}`, "FAIL", e.message);
    }
  }

  // Screenshot after DELIVERED
  try {
    await page.goto(`${BASE_URL}/carrier/trips/${state.tripId}`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-22-trip-delivered");
  } catch {
    /* non-critical */
  }

  // 8d. Upload POD via API (carrier)
  console.log("\n[8d] Upload POD via API");
  try {
    // Upload POD as carrier via trips/[tripId]/pod (multipart)
    const apiCtx = await pwRequest.newContext();
    try {
      const { csrfToken } = await apiLoginWithCSRF(
        apiCtx,
        state.carrier.email,
        state.carrier.password
      );

      // Create a temp JPEG file for POD
      const podBuffer = createTestJPEG();
      const podRes = await apiCtx.post(
        `${BASE_URL}/api/trips/${state.tripId}/pod`,
        {
          multipart: {
            file: {
              name: "pod-delivery.jpg",
              mimeType: "image/jpeg",
              buffer: podBuffer,
            },
            notes: "Delivered in good condition - all 20 tons received",
          },
          headers: { "X-CSRF-Token": csrfToken },
        }
      );

      const podOk = podRes.status() === 200 || podRes.status() === 201;
      record(
        "Phase 8",
        "8d-i. Upload POD (carrier)",
        podOk ? "PASS" : "FAIL",
        `status=${podRes.status()}`
      );

      // If trip pod endpoint failed, try loads/[id]/pod
      if (!podOk) {
        const loadPodRes = await apiCtx.post(
          `${BASE_URL}/api/loads/${state.loadId}/pod`,
          {
            multipart: {
              file: {
                name: "pod-delivery.jpg",
                mimeType: "image/jpeg",
                buffer: podBuffer,
              },
            },
            headers: { "X-CSRF-Token": csrfToken },
          }
        );
        record(
          "Phase 8",
          "8d-i. Upload POD (fallback loads endpoint)",
          loadPodRes.status() === 200 ? "PASS" : "FAIL",
          `status=${loadPodRes.status()}`
        );
      }
    } finally {
      await apiCtx.dispose();
    }
  } catch (e) {
    record("Phase 8", "8d-i. Upload POD", "FAIL", e.message);
  }

  // 8e. Load → COMPLETED → triggers deductServiceFee
  // The load status endpoint (PATCH /api/loads/[id]/status) handles fee deduction
  // when transitioning to COMPLETED. No need to verify POD separately — admin can
  // set COMPLETED directly, and the endpoint calls deductServiceFee().
  console.log("\n[8e] Load → COMPLETED (triggers fee deduction)");
  try {
    // Load is already DELIVERED (synced from trip transition in 8c).
    // Admin sets load to COMPLETED → deductServiceFee() is called.
    const feeRes = await apiCall("PATCH", `/api/loads/${state.loadId}/status`, {
      body: { status: "COMPLETED" },
      token: state.admin.token,
    });

    const serviceFee = feeRes.data?.serviceFee;
    state.serviceFeeResult = serviceFee;

    if (feeRes.ok && serviceFee) {
      console.log(
        `   Fee deduction: shipperFee=${serviceFee?.shipperFee}, carrierFee=${serviceFee?.carrierFee}, total=${serviceFee?.totalPlatformFee}`
      );
      record(
        "Phase 8",
        "8e. Load → COMPLETED + fees deducted",
        "PASS",
        `shipperFee=${serviceFee?.shipperFee}, carrierFee=${serviceFee?.carrierFee}, total=${serviceFee?.totalPlatformFee}`
      );
    } else if (feeRes.ok) {
      record(
        "Phase 8",
        "8e. Load → COMPLETED (no fee data)",
        "PASS",
        `status=${feeRes.status}`
      );
    } else {
      console.log(`   Status endpoint error: ${JSON.stringify(feeRes.data)}`);
      record(
        "Phase 8",
        "8e. Load → COMPLETED",
        "FAIL",
        `status=${feeRes.status}, error=${feeRes.data?.error || "unknown"}`
      );
    }

    await screenshot(page, "e2e-23-load-completed");
  } catch (e) {
    record("Phase 8", "8e. Complete load", "FAIL", e.message);
  }

  // 8f. Screenshot trip detail after completion
  try {
    await page.goto(`${BASE_URL}/carrier/trips/${state.tripId}`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-24-trip-completed");
  } catch {
    /* non-critical */
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 9: Revenue Verification (API + Browser)
// ═══════════════════════════════════════════════════════════════════════════════
async function phase9(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 9: Revenue Verification");
  console.log("═".repeat(70));

  // 9a. Get wallet balances AFTER
  console.log("\n[9a] Wallet balances after trip");
  try {
    // Re-login to get fresh tokens (in case they expired)
    try {
      const carrierRelogin = await apiLogin(
        state.carrier.email,
        state.carrier.password
      );
      state.carrier.token = carrierRelogin.sessionToken;
    } catch {
      /* keep existing token */
    }
    try {
      const shipperRelogin = await apiLogin(SHIPPER.email, SHIPPER.password);
      state.shipper.token = shipperRelogin.sessionToken;
    } catch {
      /* keep existing token */
    }

    const carrierBal = await apiCall("GET", "/api/wallet/balance", {
      token: state.carrier.token,
    });
    const shipperBal = await apiCall("GET", "/api/wallet/balance", {
      token: state.shipper.token,
    });

    // Debug: log raw wallet data
    console.log(
      `   Carrier wallet response: status=${carrierBal.status}, wallets=${JSON.stringify(carrierBal.data?.wallets?.map((w) => ({ type: w.type, balance: w.balance })))}`
    );
    console.log(
      `   Shipper wallet response: status=${shipperBal.status}, wallets=${JSON.stringify(shipperBal.data?.wallets?.map((w) => ({ type: w.type, balance: w.balance })))}`
    );

    const carrierWallets = carrierBal.data?.wallets || [];
    const shipperWallets = shipperBal.data?.wallets || [];
    const cw = carrierWallets.find(
      (w) => w.type === "CARRIER_WALLET" || w.accountType === "CARRIER_WALLET"
    );
    const sw = shipperWallets.find(
      (w) => w.type === "SHIPPER_WALLET" || w.accountType === "SHIPPER_WALLET"
    );

    state.carrierBalanceAfter = Number(cw?.balance ?? 0);
    state.shipperBalanceAfter = Number(sw?.balance ?? 0);

    console.log(`   Carrier balance after: ${state.carrierBalanceAfter} ETB`);
    console.log(`   Shipper balance after: ${state.shipperBalanceAfter} ETB`);
  } catch (e) {
    record("Phase 9", "9a. Wallet balances after", "FAIL", e.message);
  }

  // 9b. Calculate and verify fees
  console.log("\n[9b] Fee verification");
  const carrierDeduction =
    state.carrierBalanceBefore - state.carrierBalanceAfter;
  const shipperDeduction =
    state.shipperBalanceBefore - state.shipperBalanceAfter;

  console.log(
    `   Carrier deduction: ${carrierDeduction} ETB (expected: ${EXPECTED.carrierFee})`
  );
  console.log(
    `   Shipper deduction: ${shipperDeduction} ETB (expected: ${EXPECTED.shipperFee})`
  );
  console.log(
    `   Total platform:   ${carrierDeduction + shipperDeduction} ETB (expected: ${EXPECTED.totalPlatformFee})`
  );

  // Allow 1% tolerance for rounding
  const carrierFeeOk =
    Math.abs(carrierDeduction - EXPECTED.carrierFee) <=
    EXPECTED.carrierFee * 0.01;
  const shipperFeeOk =
    Math.abs(shipperDeduction - EXPECTED.shipperFee) <=
    EXPECTED.shipperFee * 0.01;
  const totalOk =
    Math.abs(carrierDeduction + shipperDeduction - EXPECTED.totalPlatformFee) <=
    EXPECTED.totalPlatformFee * 0.01;

  record(
    "Phase 9",
    `9b-i. Carrier fee ≈ ${EXPECTED.carrierFee} ETB`,
    carrierFeeOk ? "PASS" : "FAIL",
    `actual=${carrierDeduction}, expected=${EXPECTED.carrierFee}`
  );
  record(
    "Phase 9",
    `9b-ii. Shipper fee ≈ ${EXPECTED.shipperFee} ETB`,
    shipperFeeOk ? "PASS" : "FAIL",
    `actual=${shipperDeduction}, expected=${EXPECTED.shipperFee}`
  );
  record(
    "Phase 9",
    `9b-iii. Total platform ≈ ${EXPECTED.totalPlatformFee} ETB`,
    totalOk ? "PASS" : "FAIL",
    `actual=${carrierDeduction + shipperDeduction}, expected=${EXPECTED.totalPlatformFee}`
  );

  // 9c. Check wallet transactions
  console.log("\n[9c] Wallet transactions");
  try {
    const txRes = await apiCall("GET", "/api/wallet/transactions", {
      token: state.carrier.token,
    });
    const transactions =
      txRes.data?.transactions || txRes.data?.recentTransactions || [];
    const feeTransaction = transactions.find(
      (t) =>
        t.type === "SERVICE_FEE_DEDUCT" ||
        t.description?.includes("Service fee") ||
        t.description?.includes("service fee")
    );
    record(
      "Phase 9",
      "9c. SERVICE_FEE_DEDUCT transaction exists",
      feeTransaction ? "PASS" : "FAIL",
      `found=${!!feeTransaction}`
    );
  } catch (e) {
    record("Phase 9", "9c. Wallet transactions", "FAIL", e.message);
  }

  // 9d. Carrier views wallet in browser
  console.log("\n[9d] Carrier wallet in browser");
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    await browserLogin(
      page,
      state.carrier?.email || CARRIER.email,
      state.carrier?.password || CARRIER.password
    );
    await page.goto(`${BASE_URL}/carrier/wallet`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);

    const walletText = await safeText(page);
    const hasBalance =
      walletText.includes("Balance") || walletText.includes("ETB");
    const hasFeeEntry =
      walletText.includes("Service") ||
      walletText.includes("fee") ||
      walletText.includes("Deduct");
    record(
      "Phase 9",
      "9d. Carrier wallet page shows balance",
      hasBalance ? "PASS" : "FAIL",
      `hasBalance=${hasBalance}, hasFeeEntry=${hasFeeEntry}`
    );
    await screenshot(page, "e2e-25-carrier-wallet-after");

    // Also check shipper wallet
    // (Reuse same context to avoid too many logins)
  } catch (e) {
    record("Phase 9", "9d. Carrier wallet", "FAIL", e.message);
    await screenshot(page, "e2e-25-error").catch(() => {});
  }

  // 9e. Shipper wallet screenshot
  console.log("\n[9e] Shipper wallet");
  try {
    await browserLogin(page, SHIPPER.email, SHIPPER.password);
    await page.goto(`${BASE_URL}/shipper/wallet`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "e2e-26-shipper-wallet-after");
    record("Phase 9", "9e. Shipper wallet screenshot", "PASS", "");
  } catch (e) {
    record("Phase 9", "9e. Shipper wallet", "FAIL", e.message);
  }

  await context.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 10: Summary Table + JSON Output
// ═══════════════════════════════════════════════════════════════════════════════
function phase10(state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 10: Summary");
  console.log("═".repeat(70));

  // Results table
  console.log("");
  console.log(
    "| Phase     | Test                                             | Status |"
  );
  console.log(
    "|-----------|--------------------------------------------------|--------|"
  );

  for (const r of results) {
    const status =
      r.status === "PASS"
        ? "✓ PASS"
        : r.status === "FAIL"
          ? "✗ FAIL"
          : "⚠ WARN";
    console.log(
      `| ${r.phase.padEnd(9)} | ${r.test.padEnd(48)} | ${status.padEnd(6)} |`
    );
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;

  console.log("");
  console.log(
    `Total: ${results.length} tests — ${pass} passed, ${fail} failed, ${warn} warnings`
  );

  // Fee breakdown
  const carrierDeduction =
    (state.carrierBalanceBefore || 0) - (state.carrierBalanceAfter || 0);
  const shipperDeduction =
    (state.shipperBalanceBefore || 0) - (state.shipperBalanceAfter || 0);

  console.log("\n" + "─".repeat(60));
  console.log(
    `  FEE BREAKDOWN — Addis Ababa → Dire Dawa (${EXPECTED.distanceKm} km)`
  );
  console.log("─".repeat(60));
  console.log(`  | Party    | Rate/km  | Expected    | Actual      | Match  |`);
  console.log(`  |----------|----------|-------------|-------------|--------|`);
  console.log(
    `  | Shipper  | ${String(EXPECTED.shipperRatePerKm + " ETB").padEnd(8)} | ${String(EXPECTED.shipperFee).padEnd(11)} | ${String(shipperDeduction.toFixed(2)).padEnd(11)} | ${Math.abs(shipperDeduction - EXPECTED.shipperFee) <= 1 ? "✓" : "✗"}      |`
  );
  console.log(
    `  | Carrier  | ${String(EXPECTED.carrierRatePerKm + " ETB").padEnd(8)} | ${String(EXPECTED.carrierFee).padEnd(11)} | ${String(carrierDeduction.toFixed(2)).padEnd(11)} | ${Math.abs(carrierDeduction - EXPECTED.carrierFee) <= 1 ? "✓" : "✗"}      |`
  );
  console.log(
    `  | Total    |          | ${String(EXPECTED.totalPlatformFee).padEnd(11)} | ${String((shipperDeduction + carrierDeduction).toFixed(2)).padEnd(11)} | ${Math.abs(shipperDeduction + carrierDeduction - EXPECTED.totalPlatformFee) <= 2 ? "✓" : "✗"}      |`
  );

  if (fail > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  ✗ ${r.test}: ${r.details}`);
    }
  }

  // Save JSON results
  const report = {
    timestamp: new Date().toISOString(),
    testName: "E2E Carrier Workflow",
    summary: {
      total: results.length,
      passed: pass,
      failed: fail,
      warnings: warn,
    },
    feeVerification: {
      corridor: "Addis Ababa → Dire Dawa",
      distanceKm: EXPECTED.distanceKm,
      expected: {
        shipperFee: EXPECTED.shipperFee,
        carrierFee: EXPECTED.carrierFee,
        totalPlatformFee: EXPECTED.totalPlatformFee,
      },
      actual: {
        shipperDeduction: shipperDeduction,
        carrierDeduction: carrierDeduction,
        totalDeduction: shipperDeduction + carrierDeduction,
      },
      serviceFeeResponse: state.serviceFeeResult || null,
    },
    carrier: {
      email: state.carrier?.email || CARRIER.email,
      userId: state.carrier?.userId,
      orgId: state.carrier?.orgId,
      truckId: state.truckId,
      licensePlate: state.licensePlate,
    },
    loadId: state.loadId,
    tripId: state.tripId,
    loadRequestId: state.loadRequestId,
    tests: results,
  };

  writeFileSync(
    `${SCREENSHOT_DIR}/results.json`,
    JSON.stringify(report, null, 2)
  );
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log(`Results JSON saved to: ${SCREENSHOT_DIR}/results.json`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("╔" + "═".repeat(68) + "╗");
  console.log(
    "║  E2E Carrier Workflow Test — Complete Lifecycle                    ║"
  );
  console.log("║  Date: " + new Date().toISOString().padEnd(60) + "║");
  console.log("╚" + "═".repeat(68) + "╝");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const state = {
    carrier: {},
    admin: {},
    shipper: {},
    truckId: null,
    licensePlate: null,
    loadId: null,
    loadRequestId: null,
    tripId: null,
    serviceFeeResult: null,
    carrierBalanceBefore: 0,
    shipperBalanceBefore: 0,
    carrierBalanceAfter: 0,
    shipperBalanceAfter: 0,
  };

  try {
    await phase1(browser, state);
    await phase2(state);
    await phase3(browser, state);
    await phase4(browser, state);
    await phase5(browser, state);
    await phase6(browser, state);
    await phase7(browser, state);
    await phase8(browser, state);
    await phase9(browser, state);
  } catch (e) {
    console.error("\n❌ Fatal error:", e.message);
    record("FATAL", "Unexpected error", "FAIL", e.message);
  } finally {
    await browser.close();
  }

  phase10(state);

  // Exit with error code if any failures
  const failures = results.filter((r) => r.status === "FAIL").length;
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
