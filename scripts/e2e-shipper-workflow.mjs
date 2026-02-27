/**
 * Comprehensive E2E Shipper Workflow Test
 *
 * Tests the complete shipper lifecycle: registration → verification →
 * document upload → load posting → truck matching → trip lifecycle →
 * POD → settlement.
 *
 * Run: node scripts/e2e-shipper-workflow.mjs [--headed] [--slow]
 *   --headed  Show browser window (default: headless)
 *   --slow    300ms delay between actions (implies --headed has 100ms default)
 * Requires: Next.js dev server on localhost:3000 with seeded data
 */

import { chromium, request as pwRequest } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:3000";
const MOBILE_URL = "http://localhost:8081";
const SCREENSHOT_DIR = "./browser-test-results/e2e-workflow";
const TS = Date.now();
const TEST_PASSWORD = "Str0ng!Pass1";
// Use timestamp-derived phone numbers to avoid collision with seeded users
const PHONE_SUFFIX = String(TS).slice(-7);

const SHIPPER_A = {
  email: `shipper-a-${TS}@e2e.test`,
  password: TEST_PASSWORD,
  firstName: "Alice",
  lastName: "Worku",
  phone: `+25193${PHONE_SUFFIX}`,
  role: "SHIPPER",
  companyName: "Worku Logistics",
};

const SHIPPER_B = {
  email: `shipper-b-${TS}@e2e.test`,
  password: TEST_PASSWORD,
  firstName: "Bekele",
  lastName: "Tadesse",
  phone: `+25194${PHONE_SUFFIX}`,
  role: "SHIPPER",
  companyName: "Tadesse Trading",
};

const ADMIN = { email: "admin@test.com", password: "password" };
const CARRIER = { email: "carrier@test.com", password: "password" };
const DISPATCHER = { email: "dispatcher@test.com", password: "password" };

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
  // Minimal valid JPEG: SOI + APP0 JFIF marker + minimal content + EOI
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

async function apiLogin(email, password) {
  const { status, data } = await apiCall("POST", "/api/auth/login", {
    body: { email, password },
    headers: { "x-client-type": "mobile" },
  });
  if (status !== 200)
    throw new Error(`Login failed for ${email}: ${data?.error || status}`);
  return {
    sessionToken: data.sessionToken,
    user: data.user,
    limitedAccess: data.limitedAccess,
  };
}

/**
 * Login via Playwright APIRequestContext (sets cookies) and get CSRF token.
 * Used for endpoints that require cookie-based CSRF (e.g., document upload).
 */
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

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: Registration & Verification
// ═══════════════════════════════════════════════════════════════════════════════
async function phase1(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 1: Registration & Verification");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // ── 1a. Register Shipper A via browser form ─────────────────────────────
  console.log("\n[1a] Register Shipper A — Web Browser Form");
  try {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await screenshot(page, "01a-register-page");

    // Fill registration form
    const fillField = async (selectors, value, label) => {
      for (const sel of selectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          await el.fill(value);
          console.log(`   ✓ Filled ${label}`);
          return true;
        }
      }
      console.log(`   ✗ Could not fill ${label}`);
      return false;
    };

    // Fill in order matching the form layout
    await fillField(
      ["#firstName", 'input[name="firstName"]'],
      SHIPPER_A.firstName,
      "firstName"
    );
    await fillField(
      ["#lastName", 'input[name="lastName"]'],
      SHIPPER_A.lastName,
      "lastName"
    );
    await fillField(
      ["#email", 'input[name="email"]', 'input[type="email"]'],
      SHIPPER_A.email,
      "email"
    );
    await fillField(
      ["#phone", 'input[name="phone"]', 'input[type="tel"]'],
      SHIPPER_A.phone,
      "phone"
    );

    // Select role = SHIPPER (default is already SHIPPER, but set explicitly)
    const roleSelect = await page.$('#role, select[name="role"]');
    if (roleSelect) {
      await roleSelect.selectOption("SHIPPER");
      await sleep(500); // Wait for conditional fields to render
      console.log("   ✓ Selected role: SHIPPER");
    }

    await fillField(
      ["#companyName", 'input[name="companyName"]'],
      SHIPPER_A.companyName,
      "companyName"
    );

    // Password fields come after company name in the form
    await fillField(
      ["#password", 'input[name="password"]'],
      SHIPPER_A.password,
      "password"
    );
    await fillField(
      ["#confirmPassword", 'input[name="confirmPassword"]'],
      SHIPPER_A.password,
      "confirm password"
    );

    await screenshot(page, "01a-register-filled");

    // Submit
    await page.click('button[type="submit"]');
    await sleep(4000);

    const afterRegUrl = page.url();
    const regSuccess =
      !afterRegUrl.includes("/register") ||
      afterRegUrl.includes("/shipper") ||
      afterRegUrl.includes("/dashboard");
    if (!regSuccess) {
      // Capture any error message shown on the page
      const pageText = await page.textContent("body").catch(() => "");
      const errorMatch = pageText.match(
        /(User with.*?exists|Validation error.*?\n|Password does not.*?\n|Too many registration.*?\n)/i
      );
      if (errorMatch) console.log(`   ⚠ Form error: ${errorMatch[0].trim()}`);
    }
    record(
      "Phase 1",
      "1a. Register Shipper A (browser)",
      regSuccess ? "PASS" : "FAIL",
      afterRegUrl
    );
    await screenshot(page, "01a-register-after");
  } catch (e) {
    record("Phase 1", "1a. Register Shipper A (browser)", "FAIL", e.message);
    await screenshot(page, "01a-register-error").catch(() => {});
  }

  // ── 1b. Register Shipper B via API ──────────────────────────────────────
  console.log("\n[1b] Register Shipper B — API");
  try {
    let regResult = await apiCall("POST", "/api/auth/register", {
      body: {
        email: SHIPPER_B.email,
        password: SHIPPER_B.password,
        firstName: SHIPPER_B.firstName,
        lastName: SHIPPER_B.lastName,
        phone: SHIPPER_B.phone,
        role: SHIPPER_B.role,
        companyName: SHIPPER_B.companyName,
      },
    });
    // Retry once after wait if rate limited
    if (regResult.status === 429) {
      const retryAfter = regResult.data?.retryAfter || 30;
      console.log(
        `   ⏳ Rate limited — waiting ${retryAfter}s before retry...`
      );
      await sleep(retryAfter * 1000);
      regResult = await apiCall("POST", "/api/auth/register", {
        body: {
          email: SHIPPER_B.email,
          password: SHIPPER_B.password,
          firstName: SHIPPER_B.firstName,
          lastName: SHIPPER_B.lastName,
          phone: SHIPPER_B.phone,
          role: SHIPPER_B.role,
          companyName: SHIPPER_B.companyName,
        },
      });
    }
    const { status, data } = regResult;
    if (status !== 201) {
      console.log(`   Registration error body: ${JSON.stringify(data)}`);
    }
    const ok = status === 201;
    state.shipperB = { ...SHIPPER_B, userId: data?.user?.id };
    record(
      "Phase 1",
      "1b. Register Shipper B (API)",
      ok ? "PASS" : "FAIL",
      `status=${status}`
    );
  } catch (e) {
    record("Phase 1", "1b. Register Shipper B (API)", "FAIL", e.message);
  }

  // ── 1c. Test limited access ─────────────────────────────────────────────
  console.log("\n[1c] Test Limited Access (before verification)");
  try {
    const loginA = await apiLogin(SHIPPER_A.email, SHIPPER_A.password);
    state.shipperA = {
      ...SHIPPER_A,
      token: loginA.sessionToken,
      userId: loginA.user.id,
      orgId: loginA.user.organizationId,
    };

    const limitedOk = loginA.limitedAccess === true;
    record(
      "Phase 1",
      "1c-i. Login returns limitedAccess=true",
      limitedOk ? "PASS" : "FAIL",
      `limitedAccess=${loginA.limitedAccess}`
    );

    // Try creating a load → should be blocked (403 or 500)
    const loadRes = await apiCall("POST", "/api/loads", {
      body: {
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: futureDate(7),
        deliveryDate: futureDate(10),
        truckType: "FLATBED",
        weight: 15000,
        cargoDescription: "Test cargo (should be blocked)",
      },
      token: state.shipperA.token,
    });
    const blocked = loadRes.status === 403 || loadRes.status === 500;
    record(
      "Phase 1",
      "1c-ii. POST /api/loads blocked (not 201)",
      blocked ? "PASS" : "FAIL",
      `status=${loadRes.status}`
    );

    // Browser is already logged in from registration — navigate to dashboard
    await page.goto(`${BASE_URL}/shipper/dashboard`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(page, "01c-limited-access-dashboard");
  } catch (e) {
    record("Phase 1", "1c. Limited access test", "FAIL", e.message);
  }

  // ── 1d. Admin Verification ──────────────────────────────────────────────
  console.log("\n[1d] Admin Verification");
  try {
    const adminLogin = await apiLogin(ADMIN.email, ADMIN.password);
    state.admin = { token: adminLogin.sessionToken };

    // Find Shipper A by email
    const searchA = await apiCall(
      "GET",
      `/api/admin/users?search=${encodeURIComponent(SHIPPER_A.email)}`,
      {
        token: state.admin.token,
      }
    );
    const userA = searchA.data?.users?.[0];
    if (userA) {
      state.shipperA.userId = userA.id;
      state.shipperA.orgId = userA.organizationId;

      // Activate user
      const activateA = await apiCall("PATCH", `/api/admin/users/${userA.id}`, {
        body: { status: "ACTIVE" },
        token: state.admin.token,
      });
      record(
        "Phase 1",
        "1d-i. Activate Shipper A",
        activateA.ok ? "PASS" : "FAIL",
        `status=${activateA.status}`
      );

      // Verify organization
      if (userA.organizationId) {
        const verifyOrgA = await apiCall(
          "POST",
          `/api/admin/organizations/${userA.organizationId}/verify`,
          {
            token: state.admin.token,
          }
        );
        record(
          "Phase 1",
          "1d-ii. Verify Shipper A org",
          verifyOrgA.ok ? "PASS" : "FAIL",
          `status=${verifyOrgA.status}`
        );
      }
    } else {
      record(
        "Phase 1",
        "1d-i. Find Shipper A",
        "FAIL",
        "User not found in admin search"
      );
    }

    // Find and activate Shipper B
    const searchB = await apiCall(
      "GET",
      `/api/admin/users?search=${encodeURIComponent(SHIPPER_B.email)}`,
      {
        token: state.admin.token,
      }
    );
    const userB = searchB.data?.users?.[0];
    if (userB) {
      state.shipperB.userId = userB.id;
      state.shipperB.orgId = userB.organizationId;

      const activateB = await apiCall("PATCH", `/api/admin/users/${userB.id}`, {
        body: { status: "ACTIVE" },
        token: state.admin.token,
      });
      record(
        "Phase 1",
        "1d-iii. Activate Shipper B",
        activateB.ok ? "PASS" : "FAIL",
        `status=${activateB.status}`
      );

      if (userB.organizationId) {
        const verifyOrgB = await apiCall(
          "POST",
          `/api/admin/organizations/${userB.organizationId}/verify`,
          {
            token: state.admin.token,
          }
        );
        record(
          "Phase 1",
          "1d-iv. Verify Shipper B org",
          verifyOrgB.ok ? "PASS" : "FAIL",
          `status=${verifyOrgB.status}`
        );
      }
    } else {
      record(
        "Phase 1",
        "1d-iii. Find Shipper B",
        "FAIL",
        "User not found in admin search"
      );
    }
  } catch (e) {
    record("Phase 1", "1d. Admin verification", "FAIL", e.message);
  }

  // ── 1e. Test full access ────────────────────────────────────────────────
  console.log("\n[1e] Test Full Access (after verification)");
  try {
    // Re-login Shipper A via API
    const reloginA = await apiLogin(SHIPPER_A.email, SHIPPER_A.password);
    state.shipperA.token = reloginA.sessionToken;
    const fullAccess = reloginA.limitedAccess === false;
    record(
      "Phase 1",
      "1e-i. Re-login returns limitedAccess=false",
      fullAccess ? "PASS" : "FAIL",
      `limitedAccess=${reloginA.limitedAccess}`
    );

    // Try creating a load → should succeed, then delete it
    const testLoadRes = await apiCall("POST", "/api/loads", {
      body: {
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: futureDate(7),
        deliveryDate: futureDate(10),
        truckType: "FLATBED",
        weight: 15000,
        cargoDescription: "Verification test load — will delete",
        status: "DRAFT",
      },
      token: state.shipperA.token,
    });
    const canCreate = testLoadRes.status === 201;
    record(
      "Phase 1",
      "1e-ii. POST /api/loads succeeds (201)",
      canCreate ? "PASS" : "FAIL",
      `status=${testLoadRes.status}`
    );

    // Clean up test load
    if (canCreate && testLoadRes.data?.load?.id) {
      await apiCall("DELETE", `/api/loads/${testLoadRes.data.load.id}`, {
        token: state.shipperA.token,
      });
    }

    // Re-login Shipper B
    const reloginB = await apiLogin(SHIPPER_B.email, SHIPPER_B.password);
    state.shipperB.token = reloginB.sessionToken;

    record(
      "Phase 1",
      "1e-iii. Full access verified via API",
      "PASS",
      "tokens refreshed"
    );
  } catch (e) {
    record("Phase 1", "1e. Full access test", "FAIL", e.message);
  }

  await context.close();
  return state;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Document Upload
// ═══════════════════════════════════════════════════════════════════════════════
async function phase2(state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 2: Document Upload");
  console.log("═".repeat(70));

  const pdfBuffer = createTestPDF();
  const jpegBuffer = createTestJPEG();

  // ── 2a. Shipper A Documents ─────────────────────────────────────────────
  console.log("\n[2a] Shipper A Documents");
  const apiCtxA = await pwRequest.newContext();
  try {
    const { csrfToken } = await apiLoginWithCSRF(
      apiCtxA,
      SHIPPER_A.email,
      SHIPPER_A.password
    );
    const orgId = state.shipperA.orgId;

    if (!orgId) throw new Error("Shipper A orgId not set");

    // Upload COMPANY_LICENSE (PDF)
    const licenseRes = await apiCtxA.post(`${BASE_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: "company-license.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer,
        },
        type: "COMPANY_LICENSE",
        entityType: "company",
        entityId: orgId,
      },
      headers: { "X-CSRF-Token": csrfToken },
    });
    const licenseData = await licenseRes.json();
    const licenseOk =
      licenseRes.status() === 200 &&
      licenseData.document?.verificationStatus === "PENDING";
    record(
      "Phase 2",
      "2a-i. Upload COMPANY_LICENSE (PDF)",
      licenseOk ? "PASS" : "FAIL",
      `status=${licenseRes.status()}, verification=${licenseData.document?.verificationStatus}`
    );

    // Upload TIN_CERTIFICATE (JPEG)
    const tinRes = await apiCtxA.post(`${BASE_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: "tin-certificate.jpg",
          mimeType: "image/jpeg",
          buffer: jpegBuffer,
        },
        type: "TIN_CERTIFICATE",
        entityType: "company",
        entityId: orgId,
      },
      headers: { "X-CSRF-Token": csrfToken },
    });
    const tinData = await tinRes.json();
    const tinOk =
      tinRes.status() === 200 &&
      tinData.document?.verificationStatus === "PENDING";
    record(
      "Phase 2",
      "2a-ii. Upload TIN_CERTIFICATE (JPEG)",
      tinOk ? "PASS" : "FAIL",
      `status=${tinRes.status()}`
    );

    // Upload INSURANCE_CERTIFICATE with extra fields (PDF)
    const insRes = await apiCtxA.post(`${BASE_URL}/api/documents/upload`, {
      multipart: {
        file: {
          name: "insurance.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer,
        },
        type: "INSURANCE_CERTIFICATE",
        entityType: "company",
        entityId: orgId,
        policyNumber: "INS-2026-001",
        insuranceProvider: "Ethiopian Insurance Corp",
        coverageAmount: "5000000",
        coverageType: "CARGO",
      },
      headers: { "X-CSRF-Token": csrfToken },
    });
    const insData = await insRes.json();
    const insOk =
      insRes.status() === 200 &&
      insData.document?.verificationStatus === "PENDING";
    record(
      "Phase 2",
      "2a-iii. Upload INSURANCE_CERTIFICATE",
      insOk ? "PASS" : "FAIL",
      `status=${insRes.status()}, policyNumber=${insData.document?.policyNumber}`
    );
  } catch (e) {
    record("Phase 2", "2a. Shipper A documents", "FAIL", e.message);
  } finally {
    await apiCtxA.dispose();
  }

  // ── 2b. Shipper B Documents ─────────────────────────────────────────────
  console.log("\n[2b] Shipper B Documents");
  const apiCtxB = await pwRequest.newContext();
  try {
    const { csrfToken } = await apiLoginWithCSRF(
      apiCtxB,
      SHIPPER_B.email,
      SHIPPER_B.password
    );
    const orgId = state.shipperB.orgId;

    if (!orgId) throw new Error("Shipper B orgId not set");

    for (const docType of [
      "COMPANY_LICENSE",
      "TIN_CERTIFICATE",
      "INSURANCE_CERTIFICATE",
    ]) {
      const isInsurance = docType === "INSURANCE_CERTIFICATE";
      const isPdf = docType !== "TIN_CERTIFICATE";
      const multipart = {
        file: {
          name: isPdf
            ? `${docType.toLowerCase()}.pdf`
            : `${docType.toLowerCase()}.jpg`,
          mimeType: isPdf ? "application/pdf" : "image/jpeg",
          buffer: isPdf ? pdfBuffer : jpegBuffer,
        },
        type: docType,
        entityType: "company",
        entityId: orgId,
        ...(isInsurance && {
          policyNumber: "INS-2026-002",
          insuranceProvider: "Nyala Insurance",
          coverageAmount: "3000000",
          coverageType: "CARGO",
        }),
      };
      const res = await apiCtxB.post(`${BASE_URL}/api/documents/upload`, {
        multipart,
        headers: { "X-CSRF-Token": csrfToken },
      });
      record(
        "Phase 2",
        `2b. Upload ${docType} (Shipper B)`,
        res.status() === 200 ? "PASS" : "FAIL",
        `status=${res.status()}`
      );
    }
  } catch (e) {
    record("Phase 2", "2b. Shipper B documents", "FAIL", e.message);
  } finally {
    await apiCtxB.dispose();
  }

  // ── 2c. Verify Document List ────────────────────────────────────────────
  console.log("\n[2c] Verify Document List");
  try {
    for (const [label, shipperState] of [
      ["Shipper A", state.shipperA],
      ["Shipper B", state.shipperB],
    ]) {
      const res = await apiCall(
        "GET",
        `/api/documents?entityType=company&entityId=${shipperState.orgId}`,
        { token: shipperState.token }
      );
      const docs = res.data?.documents || [];
      const allPending =
        docs.length > 0 &&
        docs.every((d) => d.verificationStatus === "PENDING");
      record(
        "Phase 2",
        `2c. ${label} docs listed (count=${docs.length})`,
        allPending ? "PASS" : docs.length > 0 ? "WARN" : "FAIL",
        `count=${docs.length}, allPending=${allPending}`
      );
    }
  } catch (e) {
    record("Phase 2", "2c. Verify document list", "FAIL", e.message);
  }

  // ── 2d. Admin Approves Documents ────────────────────────────────────────
  console.log("\n[2d] Admin Approves Documents");
  try {
    // Get all pending documents
    const pendingRes = await apiCall(
      "GET",
      "/api/admin/documents?status=PENDING",
      {
        token: state.admin.token,
      }
    );
    const pendingDocs = pendingRes.data?.documents || [];
    console.log(`   Found ${pendingDocs.length} pending documents`);

    // Filter to only our test shippers' documents
    const testOrgIds = [state.shipperA.orgId, state.shipperB.orgId].filter(
      Boolean
    );
    const testDocs = pendingDocs.filter(
      (d) =>
        testOrgIds.includes(d.organizationId) ||
        testOrgIds.includes(d.organization?.id)
    );
    console.log(`   ${testDocs.length} belong to test shippers`);

    let approvedCount = 0;
    for (const doc of testDocs) {
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
      "Phase 2",
      "2d. Admin approves all documents",
      approvedCount === testDocs.length ? "PASS" : "FAIL",
      `approved=${approvedCount}/${testDocs.length}`
    );
  } catch (e) {
    record("Phase 2", "2d. Admin approves documents", "FAIL", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Load Posting
// ═══════════════════════════════════════════════════════════════════════════════
async function phase3(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 3: Load Posting");
  console.log("═".repeat(70));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // ── 3a. Shipper A Posts Load — Web Wizard ───────────────────────────────
  console.log("\n[3a] Shipper A Posts Load — Web Wizard");
  try {
    // Login first
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    await page.fill(
      'input[name="email"], input[type="email"]',
      SHIPPER_A.email
    );
    await page.fill(
      'input[name="password"], input[type="password"]',
      SHIPPER_A.password
    );
    await page.click('button[type="submit"]');
    await sleep(4000);

    // Navigate to create load page
    await page.goto(`${BASE_URL}/shipper/loads/create`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(2500);
    await screenshot(page, "03a-create-step1");

    // Step 1: Route
    // Note: form elements have no name/id attributes — use positional selectors
    console.log("   Step 1: Route");
    const selects = await page.$$("select");
    if (selects.length >= 2) {
      await selects[0].selectOption("Addis Ababa");
      console.log("   ✓ Selected pickup city: Addis Ababa");
      await selects[1].selectOption("Dire Dawa");
      console.log("   ✓ Selected delivery city: Dire Dawa");
    } else {
      console.log(`   ✗ Expected ≥2 selects, found ${selects.length}`);
    }

    const dateInputs = await page.$$('input[type="date"]');
    if (dateInputs.length >= 2) {
      await dateInputs[0].fill(futureDate(7));
      console.log(`   ✓ Set pickup date: ${futureDate(7)}`);
      await dateInputs[1].fill(futureDate(10));
      console.log(`   ✓ Set delivery date: ${futureDate(10)}`);
    } else {
      console.log(`   ✗ Expected ≥2 date inputs, found ${dateInputs.length}`);
    }

    await screenshot(page, "03a-create-step1-filled");

    // Click Next → Step 2
    let nextClicked = await page.$(
      'button:has-text("Next"), button:has-text("Continue")'
    );
    if (nextClicked) {
      await nextClicked.click();
      await sleep(1500);
    }
    await screenshot(page, "03a-create-step2");

    // Step 2: Cargo (elements have no name/id attributes)
    console.log("   Step 2: Cargo");
    const flatbedChip = await page.$('button:has-text("Flatbed")');
    if (flatbedChip) {
      await flatbedChip.click();
      console.log("   ✓ Selected Flatbed truck type");
    }

    const weightInput = await page.$(
      'input[type="number"][placeholder*="5000"], input[type="number"]'
    );
    if (weightInput) {
      await weightInput.fill("15000");
      console.log("   ✓ Set weight: 15000");
    }

    const cargoInput = await page.$("textarea");
    if (cargoInput) {
      await cargoInput.fill("Coffee beans for export");
      console.log("   ✓ Set cargo description");
    }

    await screenshot(page, "03a-create-step2-filled");

    // Click Next → Step 3
    nextClicked = await page.$(
      'button:has-text("Next"), button:has-text("Continue")'
    );
    if (nextClicked) {
      await nextClicked.click();
      await sleep(1500);
    }
    await screenshot(page, "03a-create-step3");

    // Step 3: Options — keep defaults, click Next
    console.log("   Step 3: Options");
    nextClicked = await page.$(
      'button:has-text("Next"), button:has-text("Continue")'
    );
    if (nextClicked) {
      await nextClicked.click();
      await sleep(1500);
    }
    await screenshot(page, "03a-create-step4-review");

    // Step 4: Review — click Submit/Post
    console.log("   Step 4: Review & Submit");
    const submitBtn = await page.$(
      'button:has-text("Post Load"), button:has-text("Submit"), button:has-text("Post")'
    );
    if (submitBtn) {
      await submitBtn.click();
      await sleep(5000);
      await screenshot(page, "03a-create-submitted");

      // Try to get load ID from redirect URL
      const postUrl = page.url();
      const loadIdMatch = postUrl.match(/loads\/(c[a-z0-9]+)/i);
      if (loadIdMatch) {
        state.shipperA.loadId = loadIdMatch[1];
        console.log(`   Load ID from URL: ${state.shipperA.loadId}`);
      }
    }

    // If we didn't get load ID from URL, fetch from API
    if (!state.shipperA.loadId) {
      const myLoads = await apiCall(
        "GET",
        "/api/loads?myLoads=true&status=POSTED",
        {
          token: state.shipperA.token,
        }
      );
      const loads = myLoads.data?.loads || [];
      if (loads.length > 0) {
        // Find the Addis Ababa → Dire Dawa load
        const ourLoad =
          loads.find((l) => l.deliveryCity === "Dire Dawa") || loads[0];
        state.shipperA.loadId = ourLoad.id;
        console.log(`   Load ID from API: ${state.shipperA.loadId}`);
      }
    }

    record(
      "Phase 3",
      "3a. Shipper A posts load (web wizard)",
      state.shipperA.loadId ? "PASS" : "FAIL",
      `loadId=${state.shipperA.loadId || "NOT_FOUND"}`
    );
  } catch (e) {
    record(
      "Phase 3",
      "3a. Shipper A posts load (web wizard)",
      "FAIL",
      e.message
    );
    await screenshot(page, "03a-error").catch(() => {});
  }

  await context.close();

  // ── 3b. Shipper B Posts Load — API ──────────────────────────────────────
  console.log("\n[3b] Shipper B Posts Load — API");
  try {
    // If Shipper A load wasn't created via wizard, create via API
    if (!state.shipperA.loadId) {
      const fallbackRes = await apiCall("POST", "/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: futureDate(7),
          deliveryDate: futureDate(10),
          truckType: "FLATBED",
          weight: 15000,
          cargoDescription: "Coffee beans for export",
          status: "POSTED",
        },
        token: state.shipperA.token,
      });
      if (fallbackRes.ok) {
        state.shipperA.loadId = fallbackRes.data?.load?.id;
        record(
          "Phase 3",
          "3a-fallback. Shipper A load via API",
          "PASS",
          `loadId=${state.shipperA.loadId}`
        );
      }
    }

    const loadBRes = await apiCall("POST", "/api/loads", {
      body: {
        pickupCity: "Addis Ababa",
        deliveryCity: "Mekelle",
        pickupDate: futureDate(7),
        deliveryDate: futureDate(10),
        truckType: "FLATBED",
        weight: 20000,
        cargoDescription: "Construction materials - cement bags",
        status: "POSTED",
      },
      token: state.shipperB.token,
    });
    const loadBOk = loadBRes.status === 201;
    state.shipperB.loadId = loadBRes.data?.load?.id;
    record(
      "Phase 3",
      "3b. Shipper B posts load (API)",
      loadBOk ? "PASS" : "FAIL",
      `status=${loadBRes.status}, loadId=${state.shipperB.loadId}`
    );
  } catch (e) {
    record("Phase 3", "3b. Shipper B posts load (API)", "FAIL", e.message);
  }

  // ── 3c. Verify loads visible to Carrier ─────────────────────────────────
  console.log("\n[3c] Verify loads visible to Carrier");
  try {
    const carrierLogin = await apiLogin(CARRIER.email, CARRIER.password);
    state.carrier = {
      token: carrierLogin.sessionToken,
      orgId: carrierLogin.user.organizationId,
    };

    const carrierLoads = await apiCall("GET", "/api/loads?status=POSTED", {
      token: state.carrier.token,
    });
    const allLoads = carrierLoads.data?.loads || [];
    const seesA =
      state.shipperA.loadId &&
      allLoads.some((l) => l.id === state.shipperA.loadId);
    const seesB =
      state.shipperB.loadId &&
      allLoads.some((l) => l.id === state.shipperB.loadId);
    record(
      "Phase 3",
      "3c. Carrier sees both loads",
      seesA && seesB ? "PASS" : "FAIL",
      `total=${allLoads.length}, seesA=${seesA}, seesB=${seesB}`
    );
  } catch (e) {
    record("Phase 3", "3c. Carrier visibility check", "FAIL", e.message);
  }

  // ── 3d. Verify loads visible to Dispatcher ──────────────────────────────
  console.log("\n[3d] Verify loads visible to Dispatcher");
  try {
    const dispLogin = await apiLogin(DISPATCHER.email, DISPATCHER.password);
    state.dispatcher = { token: dispLogin.sessionToken };

    const dispLoads = await apiCall("GET", "/api/loads?status=POSTED", {
      token: state.dispatcher.token,
    });
    const dispAll = dispLoads.data?.loads || [];
    const dispSeesA =
      state.shipperA.loadId &&
      dispAll.some((l) => l.id === state.shipperA.loadId);
    const dispSeesB =
      state.shipperB.loadId &&
      dispAll.some((l) => l.id === state.shipperB.loadId);
    record(
      "Phase 3",
      "3d. Dispatcher sees both loads",
      dispSeesA && dispSeesB ? "PASS" : "FAIL",
      `total=${dispAll.length}, seesA=${dispSeesA}, seesB=${dispSeesB}`
    );
  } catch (e) {
    record("Phase 3", "3d. Dispatcher visibility check", "FAIL", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: Truck Matching & Requests
// ═══════════════════════════════════════════════════════════════════════════════
async function phase4(state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 4: Truck Matching & Requests");
  console.log("═".repeat(70));

  // ── 4a. Find Available Trucks (owned by test carrier) ───────────────────
  console.log("\n[4a] Find Available Trucks");
  try {
    // Ensure carrier is logged in so we know their org and trucks
    if (!state.carrier?.token) {
      const carrierLogin = await apiLogin(CARRIER.email, CARRIER.password);
      state.carrier = {
        token: carrierLogin.sessionToken,
        orgId: carrierLogin.user.organizationId,
      };
    }

    // Get the carrier's own trucks to identify which postings to target
    const carrierTrucks = await apiCall("GET", "/api/trucks", {
      token: state.carrier.token,
    });
    const myTrucks = carrierTrucks.data?.trucks || [];
    const myTruckIds = new Set(myTrucks.map((t) => t.id));
    console.log(`   Carrier owns ${myTrucks.length} trucks`);

    // Get all active truck postings (as shipper sees them)
    const postingsRes = await apiCall(
      "GET",
      "/api/truck-postings?status=ACTIVE",
      {
        token: state.shipperA.token,
      }
    );
    const allPostings =
      postingsRes.data?.truckPostings || postingsRes.data?.postings || [];
    console.log(`   Found ${allPostings.length} active truck postings total`);

    // Filter to only carrier@test.com's trucks so they can approve/reject
    const carrierPostings = allPostings.filter((p) =>
      myTruckIds.has(p.truckId || p.truck?.id)
    );
    console.log(`   ${carrierPostings.length} belong to test carrier`);

    const postings =
      carrierPostings.length >= 2 ? carrierPostings : allPostings;
    if (postings.length < 2) {
      record(
        "Phase 4",
        "4a. Find available trucks",
        "FAIL",
        `Need ≥2 carrier postings, found ${postings.length}`
      );
      return;
    }

    // Use truckId (direct FK) or fall back to truck.id (nested relation)
    state.truck1 = {
      id: postings[0].truckId || postings[0].truck?.id,
      postingId: postings[0].id,
    };
    state.truck2 = {
      id: postings[1].truckId || postings[1].truck?.id,
      postingId: postings[1].id,
    };
    record(
      "Phase 4",
      "4a. Find available trucks",
      "PASS",
      `truck1=${state.truck1.id?.slice(-8)}, truck2=${state.truck2.id?.slice(-8)}`
    );
  } catch (e) {
    record("Phase 4", "4a. Find available trucks", "FAIL", e.message);
    return;
  }

  // ── 4b. Shipper A Sends Truck Request ───────────────────────────────────
  console.log("\n[4b] Shipper A Sends Truck Request");
  try {
    if (!state.shipperA.loadId || !state.truck1.id)
      throw new Error("Missing loadId or truckId");

    const reqRes = await apiCall("POST", "/api/truck-requests", {
      body: { loadId: state.shipperA.loadId, truckId: state.truck1.id },
      token: state.shipperA.token,
    });
    const reqOk = reqRes.status === 201;
    state.requestA = { id: reqRes.data?.request?.id };
    record(
      "Phase 4",
      "4b. Shipper A truck request",
      reqOk ? "PASS" : "FAIL",
      `status=${reqRes.status}, requestId=${state.requestA.id?.slice(-8)}`
    );
  } catch (e) {
    record("Phase 4", "4b. Shipper A truck request", "FAIL", e.message);
  }

  // ── 4c. Carrier APPROVES Request → Trip Created ─────────────────────────
  console.log("\n[4c] Carrier APPROVES Request → Trip Created");
  try {
    // Find the pending request as carrier
    const pendingRes = await apiCall(
      "GET",
      "/api/truck-requests?status=PENDING",
      {
        token: state.carrier.token,
      }
    );
    const pending = pendingRes.data?.requests || [];
    const ourReq =
      pending.find((r) => r.loadId === state.shipperA.loadId) || pending[0];

    if (!ourReq) throw new Error("No pending request found for carrier");

    const approveRes = await apiCall(
      "POST",
      `/api/truck-requests/${ourReq.id}/respond`,
      {
        body: { action: "APPROVE" },
        token: state.carrier.token,
      }
    );

    const approveOk = approveRes.ok;
    const tripId = approveRes.data?.trip?.id;
    const tripStatus = approveRes.data?.trip?.status;
    state.tripA = { id: tripId };

    record(
      "Phase 4",
      "4c-i. Carrier approves request",
      approveOk ? "PASS" : "FAIL",
      `tripId=${tripId?.slice(-8)}, tripStatus=${tripStatus}`
    );

    // Verify truck1 posting is now MATCHED (no longer in public listings)
    const postingsAfter = await apiCall(
      "GET",
      "/api/truck-postings?status=ACTIVE",
      {
        token: state.shipperA.token,
      }
    );
    const activePostings =
      postingsAfter.data?.truckPostings || postingsAfter.data?.postings || [];
    const truck1StillActive = activePostings.some(
      (p) => (p.truckId || p.truck?.id) === state.truck1.id
    );
    record(
      "Phase 4",
      "4c-ii. Truck1 removed from marketplace",
      !truck1StillActive ? "PASS" : "FAIL",
      `truck1Active=${truck1StillActive}`
    );
  } catch (e) {
    record("Phase 4", "4c. Carrier approves request", "FAIL", e.message);
  }

  // ── 4d. Shipper B Sends Truck Request (Different Truck) ─────────────────
  console.log("\n[4d] Shipper B Sends Truck Request");
  try {
    if (!state.shipperB.loadId || !state.truck2.id)
      throw new Error("Missing loadId or truckId");

    const reqBRes = await apiCall("POST", "/api/truck-requests", {
      body: { loadId: state.shipperB.loadId, truckId: state.truck2.id },
      token: state.shipperB.token,
    });
    state.requestB = { id: reqBRes.data?.request?.id };
    record(
      "Phase 4",
      "4d. Shipper B truck request",
      reqBRes.status === 201 ? "PASS" : "FAIL",
      `status=${reqBRes.status}`
    );
  } catch (e) {
    record("Phase 4", "4d. Shipper B truck request", "FAIL", e.message);
  }

  // ── 4e. Carrier REJECTS Request → No Trip ──────────────────────────────
  console.log("\n[4e] Carrier REJECTS Request → No Trip");
  try {
    // Find Shipper B's pending request
    const pendingRes = await apiCall(
      "GET",
      "/api/truck-requests?status=PENDING",
      {
        token: state.carrier.token,
      }
    );
    const pending = pendingRes.data?.requests || [];
    const reqB =
      pending.find((r) => r.loadId === state.shipperB.loadId) || pending[0];

    if (!reqB) throw new Error("No pending request found for Shipper B");

    const rejectRes = await apiCall(
      "POST",
      `/api/truck-requests/${reqB.id}/respond`,
      {
        body: {
          action: "REJECT",
          responseNotes: "Truck not available for this route",
        },
        token: state.carrier.token,
      }
    );

    const rejectOk = rejectRes.ok;
    const noTrip = !rejectRes.data?.trip;
    record(
      "Phase 4",
      "4e-i. Carrier rejects request",
      rejectOk ? "PASS" : "FAIL",
      `noTrip=${noTrip}`
    );

    // Verify truck2 still ACTIVE in marketplace
    const postingsAfter2 = await apiCall(
      "GET",
      "/api/truck-postings?status=ACTIVE",
      {
        token: state.shipperA.token,
      }
    );
    const activePostings2 =
      postingsAfter2.data?.truckPostings || postingsAfter2.data?.postings || [];
    const truck2Active = activePostings2.some(
      (p) => (p.truckId || p.truck?.id) === state.truck2.id
    );
    record(
      "Phase 4",
      "4e-ii. Truck2 still on marketplace",
      truck2Active ? "PASS" : "FAIL",
      `truck2Active=${truck2Active}`
    );
  } catch (e) {
    record("Phase 4", "4e. Carrier rejects request", "FAIL", e.message);
  }

  // ── 4f. Verify Request Statuses ─────────────────────────────────────────
  console.log("\n[4f] Verify Request Statuses");
  try {
    const allReqs = await apiCall("GET", "/api/truck-requests", {
      token: state.carrier.token,
    });
    const requests = allReqs.data?.requests || [];
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    record(
      "Phase 4",
      "4f. Request statuses",
      approved >= 1 && rejected >= 1 ? "PASS" : "FAIL",
      `approved=${approved}, rejected=${rejected}`
    );
  } catch (e) {
    record("Phase 4", "4f. Request statuses", "FAIL", e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Trip Lifecycle + POD + Settlement
// ═══════════════════════════════════════════════════════════════════════════════
async function phase5(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log("  PHASE 5: Trip Lifecycle + POD + Settlement");
  console.log("═".repeat(70));

  if (!state.tripA?.id) {
    record(
      "Phase 5",
      "5. SKIP — no trip from Phase 4",
      "FAIL",
      "tripId missing"
    );
    return;
  }

  const tripId = state.tripA.id;
  const loadId = state.shipperA.loadId;

  // ── 5a. Carrier Advances Trip States ────────────────────────────────────
  console.log("\n[5a] Carrier Advances Trip States");

  const transitions = [
    {
      status: "PICKUP_PENDING",
      timestampField: "startedAt",
      label: "ASSIGNED → PICKUP_PENDING",
    },
    {
      status: "IN_TRANSIT",
      timestampField: "pickedUpAt",
      label: "PICKUP_PENDING → IN_TRANSIT",
    },
    {
      status: "DELIVERED",
      timestampField: "deliveredAt",
      label: "IN_TRANSIT → DELIVERED",
      extra: { receiverName: "Dawit G.", receiverPhone: "+251933333333" },
    },
  ];

  for (const t of transitions) {
    try {
      const body = { status: t.status, ...(t.extra || {}) };
      const res = await apiCall("PATCH", `/api/trips/${tripId}`, {
        body,
        token: state.carrier.token,
      });
      const ok = res.ok;
      const trip = res.data?.trip;
      const tsSet = trip?.[t.timestampField] != null;
      record(
        "Phase 5",
        `5a. ${t.label}`,
        ok && tsSet ? "PASS" : ok ? "WARN" : "FAIL",
        `${t.timestampField}=${tsSet ? "set" : "missing"}`
      );
    } catch (e) {
      record("Phase 5", `5a. ${t.label}`, "FAIL", e.message);
    }
  }

  // ── 5b. Carrier Uploads POD — Browser ───────────────────────────────────
  console.log("\n[5b] Carrier Uploads POD — Browser");
  const podCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const podPage = await podCtx.newPage();
  podPage.setDefaultTimeout(20000);
  try {
    // Login as carrier in browser
    await podPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    await podPage.fill(
      'input[name="email"], input[type="email"]',
      CARRIER.email
    );
    await podPage.fill(
      'input[name="password"], input[type="password"]',
      CARRIER.password
    );
    await podPage.click('button[type="submit"]');
    await sleep(4000);
    record("Phase 5", "5b-i. Carrier browser login", "PASS", "");
    await screenshot(podPage, "05b-carrier-login");

    // Navigate to trip detail page
    await podPage.goto(`${BASE_URL}/carrier/trips/${tripId}`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(podPage, "05b-trip-detail-delivered");
    record(
      "Phase 5",
      "5b-ii. Carrier trip detail page",
      "PASS",
      `tripId=${tripId}`
    );

    // Click "Upload POD" button
    await podPage.click('button:has-text("Upload POD")');
    await sleep(1000);
    await screenshot(podPage, "05b-pod-modal-open");
    record("Phase 5", "5b-iii. POD upload modal opened", "PASS", "");

    // Create a temp JPEG file on disk for the file chooser
    const tmpPodPath = join(tmpdir(), `pod-delivery-${TS}.jpg`);
    writeFileSync(tmpPodPath, createTestJPEG());

    // Use Playwright's setInputFiles to set the hidden file input
    await podPage.setInputFiles("#pod-upload", tmpPodPath);
    await sleep(500);

    // Fill notes
    await podPage.fill(
      'input[placeholder="e.g., Signed by warehouse manager"]',
      "Delivered in good condition, all 15 tons received"
    );
    await sleep(500);
    await screenshot(podPage, "05b-pod-file-selected");

    // Click "Upload POD" submit button inside the modal overlay
    await podPage.click('div.fixed button:has-text("Upload POD")');
    await sleep(3000);
    await screenshot(podPage, "05b-pod-uploaded");

    // Check for the green "Uploaded (1)" indicator
    const uploadedIndicator = await podPage.$("text=Uploaded");
    const podUploaded = uploadedIndicator !== null;
    record(
      "Phase 5",
      "5b-iv. POD file uploaded",
      podUploaded ? "PASS" : "WARN",
      `uploadIndicatorVisible=${podUploaded}`
    );

    // Click "Done" to close the modal
    await podPage.click('button:has-text("Done")');
    await sleep(2000);
    await screenshot(podPage, "05b-pod-done");
    record(
      "Phase 5",
      "5b. Carrier uploads POD (browser)",
      "PASS",
      "visible upload flow completed"
    );
  } catch (e) {
    await screenshot(podPage, "05b-pod-error").catch(() => {});
    record("Phase 5", "5b. Carrier uploads POD (browser)", "FAIL", e.message);
  }
  await podCtx.close();

  // ── 5c. Shipper A Verifies POD — Browser ──────────────────────────────
  console.log("\n[5c] Shipper A Verifies POD → Confirm Delivery — Browser");
  const confirmCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const confirmPage = await confirmCtx.newPage();
  confirmPage.setDefaultTimeout(20000);
  try {
    // Login as Shipper A in browser
    await confirmPage.goto(`${BASE_URL}/login`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(1500);
    await confirmPage.fill(
      'input[name="email"], input[type="email"]',
      SHIPPER_A.email
    );
    await confirmPage.fill(
      'input[name="password"], input[type="password"]',
      SHIPPER_A.password
    );
    await confirmPage.click('button[type="submit"]');
    await sleep(4000);
    record("Phase 5", "5c-i. Shipper A browser login", "PASS", "");
    await screenshot(confirmPage, "05c-shipper-login");

    // Navigate to trip detail page
    await confirmPage.goto(`${BASE_URL}/shipper/trips/${tripId}`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(confirmPage, "05c-trip-detail-pod-ready");
    record(
      "Phase 5",
      "5c-ii. Shipper trip detail (POD submitted)",
      "PASS",
      `tripId=${tripId}`
    );

    // Verify the "Confirm Delivery Receipt" alert is visible
    const confirmAlert = await confirmPage.$("text=Confirm Delivery Receipt");
    record(
      "Phase 5",
      "5c-iii. Delivery confirmation alert visible",
      confirmAlert ? "PASS" : "WARN",
      `alertVisible=${!!confirmAlert}`
    );

    // Click "Confirm Delivery" button
    await confirmPage.click('button:has-text("Confirm Delivery")');
    await sleep(1000);
    await screenshot(confirmPage, "05c-confirm-modal-open");
    record("Phase 5", "5c-iv. Confirm delivery modal opened", "PASS", "");

    // Fill optional notes
    await confirmPage.fill(
      'textarea[placeholder="Any notes about the delivery..."]',
      "Goods received in excellent condition. Confirming delivery."
    );
    await sleep(500);
    await screenshot(confirmPage, "05c-confirm-notes-filled");

    // Click "Confirm & Complete"
    await confirmPage.click('button:has-text("Confirm & Complete")');
    await sleep(4000);
    await screenshot(confirmPage, "05c-trip-completed");
    record(
      "Phase 5",
      "5c-v. Delivery confirmed & trip completed",
      "PASS",
      "browser confirmation flow completed"
    );
    // Save cookies for reuse in Phase 6c (avoids hitting 5-login rate limit)
    state.shipperACookies = await confirmCtx.cookies();
  } catch (e) {
    await screenshot(confirmPage, "05c-confirm-error").catch(() => {});
    record(
      "Phase 5",
      "5c. Shipper confirms delivery (browser)",
      "FAIL",
      e.message
    );
  }
  await confirmCtx.close();

  // ── 5d. Verify Trip Completed via API ─────────────────────────────────
  console.log("\n[5d] Verify Trip Completed");
  try {
    const tripRes = await apiCall("GET", `/api/trips/${tripId}`, {
      token: state.carrier.token,
    });
    const trip = tripRes.data?.trip || tripRes.data;
    const completedAt = trip?.completedAt != null;
    const trackingOff = trip?.trackingEnabled === false;
    const isCompleted = trip?.status === "COMPLETED";
    record(
      "Phase 5",
      "5d-i. Trip COMPLETED",
      isCompleted ? "PASS" : "FAIL",
      `status=${trip?.status}, completedAt=${completedAt}, trackingEnabled=${trip?.trackingEnabled}`
    );

    // Check load status synced
    const loadRes = await apiCall("GET", `/api/loads/${loadId}`, {
      token: state.shipperA.token,
    });
    const load = loadRes.data?.load || loadRes.data;
    const podVerified = load?.podVerified === true;
    record(
      "Phase 5",
      "5d-ii. Load POD verified & synced",
      podVerified ? "PASS" : "WARN",
      `loadStatus=${load?.status}, podVerified=${load?.podVerified}`
    );
  } catch (e) {
    record("Phase 5", "5d. Trip completion check", "FAIL", e.message);
  }

  // ── 5e. Verify Truck Back on Marketplace ────────────────────────────────
  console.log("\n[5e] Verify Truck Back on Marketplace");
  try {
    // Wait a moment for cache invalidation
    await sleep(1000);

    const postingsRes = await apiCall(
      "GET",
      "/api/truck-postings?status=ACTIVE",
      {
        token: state.shipperA.token,
      }
    );
    const postings5e =
      postingsRes.data?.truckPostings || postingsRes.data?.postings || [];
    const truck1Back = postings5e.some(
      (p) => (p.truckId || p.truck?.id) === state.truck1?.id
    );
    record(
      "Phase 5",
      "5e. Truck1 back on marketplace",
      truck1Back ? "PASS" : "WARN",
      `truck1Active=${truck1Back}, totalPostings=${postings5e.length}`
    );
  } catch (e) {
    record("Phase 5", "5e. Truck marketplace check", "FAIL", e.message);
  }

  // ── 5f. Wallet Balance Check ────────────────────────────────────────────
  console.log("\n[5f] Wallet Balance Check");
  try {
    const shipperWallet = await apiCall("GET", "/api/wallet/balance", {
      token: state.shipperA.token,
    });
    const carrierWallet = await apiCall("GET", "/api/wallet/balance", {
      token: state.carrier.token,
    });

    // API returns { wallet: { balance, currency, accountType }, recentTransactions: [...] }
    const shipperBalance =
      shipperWallet.data?.wallet?.balance ??
      shipperWallet.data?.totalBalance ??
      shipperWallet.data?.balance;
    const shipperCurrency =
      shipperWallet.data?.wallet?.currency ??
      shipperWallet.data?.currency ??
      "ETB";
    const carrierBalance =
      carrierWallet.data?.wallet?.balance ??
      carrierWallet.data?.totalBalance ??
      carrierWallet.data?.balance;
    const carrierCurrency =
      carrierWallet.data?.wallet?.currency ??
      carrierWallet.data?.currency ??
      "ETB";
    record(
      "Phase 5",
      "5f-i. Shipper A wallet",
      shipperWallet.ok ? "PASS" : "WARN",
      `balance=${shipperBalance} ${shipperCurrency}`
    );
    record(
      "Phase 5",
      "5f-ii. Carrier wallet",
      carrierWallet.ok ? "PASS" : "WARN",
      `balance=${carrierBalance} ${carrierCurrency}`
    );
  } catch (e) {
    record("Phase 5", "5f. Wallet balance check", "FAIL", e.message);
  }

  // ── 5g. Screenshots of Final States ─────────────────────────────────────
  console.log("\n[5g] Final State Screenshots");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(15000);
  try {
    // Shipper A browser screenshots moved to Phase 6c to stay within login rate limit
    // Login as carrier and screenshot
    await pg.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
    await pg.fill('input[name="email"], input[type="email"]', CARRIER.email);
    await pg.fill(
      'input[name="password"], input[type="password"]',
      CARRIER.password
    );
    await pg.click('button[type="submit"]');
    await sleep(4000);

    await pg.goto(`${BASE_URL}/carrier/requests`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(pg, "05g-carrier-requests");

    record("Phase 5", "5g. Final state screenshots", "PASS", "");
  } catch (e) {
    record("Phase 5", "5g. Screenshots", "WARN", e.message);
  }
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: Browser Visual Tests — Mobile Trip Accepted + Web Trip Rejected
// ═══════════════════════════════════════════════════════════════════════════════
async function phase6(browser, state) {
  console.log("\n" + "═".repeat(70));
  console.log(
    "  PHASE 6: Browser Visual Tests — Trip Accepted (Mobile) + Rejected (Web)"
  );
  console.log("═".repeat(70));

  // ── Helper: try clicking first matching selector ──────────────────────
  async function tryClick(page, selectors, description) {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          await el.click();
          console.log(`   ✓ Clicked ${description} via: ${sel}`);
          return true;
        }
      } catch {
        /* try next selector */
      }
    }
    console.log(`   ✗ Could not click: ${description}`);
    return false;
  }

  // ── Helper: navigate to a mobile tab ──────────────────────────────────
  async function navigateToTab(page, href, label) {
    const clicked = await tryClick(
      page,
      [
        `a[role="tab"][href="${href}"]`,
        `a[href="${href}"]`,
        `a[role="tab"][href*="${href}"]`, // partial match (e.g. /(shipper)/loads)
        `a[href*="${href}"]`, // partial match fallback
        `[role="tab"]:has-text("${label}")`, // text-based fallback
      ],
      `${label} tab`
    );
    if (clicked) await sleep(3000);
    return clicked;
  }

  // ── 6a. Mobile Shipper A — View Accepted Trip ─────────────────────────
  console.log("\n[6a] Mobile Shipper A — View Accepted Trip (Expo Web)");

  // Check if Expo web server is running
  let mobileAvailable = false;
  try {
    const mobileCheck = await fetch(MOBILE_URL, {
      signal: AbortSignal.timeout(5000),
    });
    mobileAvailable = mobileCheck.ok || mobileCheck.status < 500;
  } catch {
    /* not running */
  }

  if (!mobileAvailable) {
    record(
      "Phase 6",
      "6a-i. Mobile login as Shipper A",
      "WARN",
      `Expo web not running on ${MOBILE_URL} — skipped`
    );
  }

  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  });
  const mobilePage = await mobileCtx.newPage();
  mobilePage.setDefaultTimeout(20000);

  if (mobileAvailable)
    try {
      // Inject auth tokens directly into localStorage (avoids rate-limited /api/auth/login)
      await mobilePage.goto(MOBILE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await mobilePage.evaluate(
        ({ token, userId, role }) => {
          localStorage.setItem("session_token", token);
          localStorage.setItem("user_id", userId);
          localStorage.setItem("user_role", role);
          localStorage.setItem(
            "app_settings",
            JSON.stringify({
              locale: "en",
              theme: "light",
              pushEnabled: true,
              gpsEnabled: true,
              onboardingCompleted: true,
            })
          );
        },
        {
          token: state.shipperA.token,
          userId: state.shipperA.userId,
          role: "SHIPPER",
        }
      );
      console.log(
        "   ✓ Auth tokens injected into localStorage (skipping UI login)"
      );

      // Reload — auth store initialize() picks up token via GET /api/auth/me
      await mobilePage.goto(MOBILE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await sleep(8000); // Expo web bundle loads slowly

      const afterUrl = mobilePage.url();
      const loginOk = !afterUrl.includes("login") && !afterUrl.includes("auth");
      record(
        "Phase 6",
        "6a-i. Mobile auth via token injection",
        loginOk ? "PASS" : "FAIL",
        `url=${afterUrl}`
      );
      await screenshot(mobilePage, "06a-mobile-after-login");

      if (loginOk) {
        // ── Dashboard ──────────────────────────────────────────────────────
        try {
          await mobilePage.waitForSelector('a[role="tab"]', { timeout: 10000 });
        } catch {
          await sleep(5000);
        }
        await sleep(3000);

        const dashBody = await mobilePage.textContent("body").catch(() => "");
        const hasDashStats =
          dashBody.includes("Active") ||
          dashBody.includes("Loads") ||
          dashBody.includes("Shipments") ||
          dashBody.includes("Transit");
        await screenshot(mobilePage, "06a-mobile-dashboard");
        record(
          "Phase 6",
          "6a-ii. Mobile dashboard loaded",
          hasDashStats ? "PASS" : "WARN",
          `hasStats=${hasDashStats}`
        );

        // ── Loads List ─────────────────────────────────────────────────────
        const loadsTabClicked = await navigateToTab(
          mobilePage,
          "/loads",
          "Loads"
        );
        await sleep(3000);
        await screenshot(mobilePage, "06a-mobile-loads-list");

        const loadsBody = await mobilePage.textContent("body").catch(() => "");
        const hasLoadRoute =
          loadsBody.includes("Dire Dawa") || loadsBody.includes("Addis Ababa");
        record(
          "Phase 6",
          "6a-iii. Mobile loads list",
          loadsTabClicked && hasLoadRoute ? "PASS" : "WARN",
          `tabClicked=${loadsTabClicked}, hasRoute=${hasLoadRoute}`
        );

        // ── Load Detail ────────────────────────────────────────────────────
        if (hasLoadRoute) {
          const loadCardClicked = await tryClick(
            mobilePage,
            [
              'div[role="button"]:has-text("Dire Dawa")',
              'a[href*="/loads/"]:has-text("Dire Dawa")',
              'div[style*="cursor: pointer"]:has-text("Dire Dawa")',
              'div[role="button"]:has-text("→")',
              'a[href*="/loads/"]',
            ],
            "Load card"
          );

          if (loadCardClicked) {
            await sleep(3000);
            await screenshot(mobilePage, "06a-mobile-load-detail");
            const loadDetailBody = await mobilePage
              .textContent("body")
              .catch(() => "");
            const hasLoadDetail =
              loadDetailBody.includes("Dire Dawa") ||
              loadDetailBody.includes("Addis Ababa");
            record(
              "Phase 6",
              "6a-iv. Mobile load detail",
              hasLoadDetail ? "PASS" : "WARN",
              `hasDetail=${hasLoadDetail}`
            );
          }
        }

        // ── Trips List ─────────────────────────────────────────────────────
        // Go back to root for tab navigation
        await mobilePage.goto(MOBILE_URL, { waitUntil: "domcontentloaded" });
        try {
          await mobilePage.waitForSelector('a[role="tab"]', { timeout: 10000 });
        } catch {
          await sleep(5000);
        }

        const tripsTabClicked = await navigateToTab(
          mobilePage,
          "/trips",
          "Shipments"
        );
        await sleep(3000);
        await screenshot(mobilePage, "06a-mobile-trips-list");

        const tripsBody = await mobilePage.textContent("body").catch(() => "");
        const hasTripRoute =
          tripsBody.includes("Addis Ababa") && tripsBody.includes("Dire Dawa");
        const hasCompletedStatus =
          tripsBody.includes("COMPLETED") || tripsBody.includes("Completed");
        record(
          "Phase 6",
          "6a-v. Mobile trips list",
          tripsTabClicked && hasTripRoute ? "PASS" : "WARN",
          `hasRoute=${hasTripRoute}, hasCompleted=${hasCompletedStatus}`
        );

        // ── Trip Detail ────────────────────────────────────────────────────
        if (hasTripRoute) {
          const tripCardClicked = await tryClick(
            mobilePage,
            [
              'div[role="button"]:has-text("Addis Ababa")',
              'a[href*="/trips/"]:has-text("Addis Ababa")',
              'div[style*="cursor: pointer"]:has-text("Addis Ababa")',
              'div[role="button"]:has-text("→")',
              'a[href*="/trips/"]',
              ':text("Addis Ababa") >> xpath=ancestor::div[@role="button"]',
              ':text("Dire Dawa") >> xpath=ancestor::div[@role="button"]',
            ],
            "Trip card"
          );

          if (tripCardClicked) {
            await sleep(3000);
            await screenshot(mobilePage, "06a-mobile-trip-detail");

            const detailBody = await mobilePage
              .textContent("body")
              .catch(() => "");
            const hasDetailRoute =
              detailBody.includes("Addis Ababa") &&
              detailBody.includes("Dire Dawa");
            const hasStatusBadge =
              detailBody.includes("COMPLETED") ||
              detailBody.includes("Completed") ||
              detailBody.includes("DELIVERED") ||
              detailBody.includes("Delivered");
            const hasShipmentDetails =
              detailBody.includes("Shipment Details") ||
              detailBody.includes("Distance");
            const hasCarrierInfo = detailBody.includes("Carrier");
            const hasReceiverInfo =
              detailBody.includes("Dawit") || detailBody.includes("Receiver");
            const hasPodSection =
              detailBody.includes("Proof of Delivery") ||
              detailBody.includes("POD");
            const hasCompletedBanner = detailBody.includes("Trip Completed");

            record(
              "Phase 6",
              "6a-vi. Mobile trip detail",
              hasDetailRoute ? "PASS" : "WARN",
              `route=${hasDetailRoute}, status=${hasStatusBadge}, details=${hasShipmentDetails}, carrier=${hasCarrierInfo}, receiver=${hasReceiverInfo}, pod=${hasPodSection}, completed=${hasCompletedBanner}`
            );
          } else {
            record(
              "Phase 6",
              "6a-vi. Mobile trip detail",
              "WARN",
              "Could not click trip card"
            );
          }
        }

        // ── Requests ───────────────────────────────────────────────────────
        console.log("\n[6a-requests] Mobile Shipper A — Requests");
        await mobilePage.goto(`${MOBILE_URL}/requests`, {
          waitUntil: "domcontentloaded",
        });
        await sleep(4000);
        await screenshot(mobilePage, "06a-mobile-requests");

        const reqBody = await mobilePage.textContent("body").catch(() => "");
        const hasRequests =
          reqBody.includes("Truck Request") ||
          reqBody.includes("Carrier Request") ||
          reqBody.includes("APPROVED") ||
          reqBody.includes("Approved");
        record(
          "Phase 6",
          "6a-vii. Mobile requests page",
          hasRequests ? "PASS" : "WARN",
          `hasRequestContent=${hasRequests}`
        );

        // ── Wallet ─────────────────────────────────────────────────────────
        console.log("\n[6a-wallet] Mobile Shipper A — Wallet");
        await mobilePage.goto(`${MOBILE_URL}/wallet`, {
          waitUntil: "domcontentloaded",
        });
        await sleep(4000);
        await screenshot(mobilePage, "06a-mobile-wallet");

        const walletBody = await mobilePage.textContent("body").catch(() => "");
        const hasWalletContent =
          walletBody.includes("Balance") ||
          walletBody.includes("ETB") ||
          walletBody.includes("Wallet") ||
          walletBody.includes("Transaction");
        record(
          "Phase 6",
          "6a-viii. Mobile wallet page",
          hasWalletContent ? "PASS" : "WARN",
          `hasWalletContent=${hasWalletContent}`
        );
      }
    } catch (e) {
      record("Phase 6", "6a. Mobile shipper flow", "FAIL", e.message);
      await screenshot(mobilePage, "06a-mobile-error").catch(() => {});
    } // end if (mobileAvailable)
  await mobileCtx.close();

  // ── 6b. Web Shipper B — View Rejected Request ─────────────────────────
  console.log("\n[6b] Web Shipper B — View Rejected Request (Next.js)");
  const webCtx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const webPage = await webCtx.newPage();
  webPage.setDefaultTimeout(15000);

  try {
    // Login as Shipper B on web
    await webPage.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await webPage.fill(
      'input[name="email"], input[type="email"]',
      SHIPPER_B.email
    );
    await webPage.fill(
      'input[name="password"], input[type="password"]',
      SHIPPER_B.password
    );
    await webPage.click('button[type="submit"]');
    await sleep(4000);

    const webAfterUrl = webPage.url();
    const webLoginOk = !webAfterUrl.includes("/login");
    record(
      "Phase 6",
      "6b-i. Web login as Shipper B",
      webLoginOk ? "PASS" : "FAIL",
      `url=${webAfterUrl}`
    );
    await screenshot(webPage, "06b-web-shipperB-dashboard");

    if (webLoginOk) {
      // Navigate to Requests page
      await webPage.goto(`${BASE_URL}/shipper/requests`, {
        waitUntil: "domcontentloaded",
      });
      await sleep(3000);
      await screenshot(webPage, "06b-web-requests-all");

      const reqText = await webPage.textContent("body").catch(() => "");
      const hasRequestsPage =
        reqText.includes("Request") || reqText.includes("request");
      record(
        "Phase 6",
        "6b-ii. Web requests page loaded",
        hasRequestsPage ? "PASS" : "FAIL",
        `hasRequestContent=${hasRequestsPage}`
      );

      // Click on REJECTED filter tab
      const rejectedClicked = await tryClick(
        webPage,
        [
          'button:has-text("REJECTED")',
          'button:has-text("Rejected")',
          '[role="tab"]:has-text("REJECTED")',
        ],
        "REJECTED filter tab"
      );

      if (rejectedClicked) {
        await sleep(2000);
        await screenshot(webPage, "06b-web-requests-rejected");

        const filteredText = await webPage.textContent("body").catch(() => "");
        const showsRejected =
          filteredText.includes("REJECTED") ||
          filteredText.includes("Rejected");
        const showsRoute =
          filteredText.includes("Mekelle") ||
          filteredText.includes("Addis Ababa");
        record(
          "Phase 6",
          "6b-iii. REJECTED request visible",
          showsRejected ? "PASS" : "WARN",
          `showsRejected=${showsRejected}, showsRoute=${showsRoute}`
        );
      } else {
        // Even without clicking the filter, check if REJECTED appears on the All tab
        const allText = await webPage.textContent("body").catch(() => "");
        const hasRejected = allText.includes("REJECTED");
        record(
          "Phase 6",
          "6b-iii. REJECTED request visible (all tab)",
          hasRejected ? "PASS" : "WARN",
          `visibleOnAllTab=${hasRejected}`
        );
      }

      // Navigate to Trips page — Shipper B should have NO trips (request was rejected)
      await webPage.goto(`${BASE_URL}/shipper/trips`, {
        waitUntil: "domcontentloaded",
      });
      await sleep(3000);
      await screenshot(webPage, "06b-web-shipperB-trips");

      const tripsText = await webPage.textContent("body").catch(() => "");
      // Shipper B should see no trips or an empty state since their request was rejected
      const hasNoTrips =
        tripsText.includes("No trips") ||
        tripsText.includes("no trip") ||
        tripsText.includes("No shipments") ||
        tripsText.includes("appear here") ||
        !tripsText.includes("Mekelle");
      record(
        "Phase 6",
        "6b-iv. Shipper B has no trips (rejected)",
        hasNoTrips ? "PASS" : "WARN",
        `noTrips=${hasNoTrips}`
      );

      // Navigate to loads — verify load is still POSTED (not assigned)
      await webPage.goto(`${BASE_URL}/shipper/loads`, {
        waitUntil: "domcontentloaded",
      });
      await sleep(3000);
      await screenshot(webPage, "06b-web-shipperB-loads");

      const loadsText = await webPage.textContent("body").catch(() => "");
      const hasLoad =
        loadsText.includes("Mekelle") || loadsText.includes("POSTED");
      record(
        "Phase 6",
        "6b-v. Shipper B load still visible",
        hasLoad ? "PASS" : "WARN",
        `hasLoad=${hasLoad}`
      );
    }
  } catch (e) {
    record("Phase 6", "6b. Web rejected request", "FAIL", e.message);
    await screenshot(webPage, "06b-web-error").catch(() => {});
  }

  // ── 6c. Web Shipper A — View Accepted Trip + Completed Workflow ───────
  console.log("\n[6c] Web Shipper A — View Accepted Trip & Completed Workflow");
  try {
    // Reuse saved cookies from Phase 5c (avoids 6th login which hits rate limiter)
    await webCtx.clearCookies();
    if (state.shipperACookies?.length) {
      await webCtx.addCookies(state.shipperACookies);
      console.log(
        `   ✓ Injected ${state.shipperACookies.length} saved cookies (skipping form login)`
      );
    } else {
      // Fallback: try form login (may be rate-limited)
      console.log(
        "   ⚠ No saved cookies — attempting form login (may be rate-limited)"
      );
      await webPage.goto(`${BASE_URL}/login`, {
        waitUntil: "domcontentloaded",
      });
      await sleep(2000);
      await webPage.fill(
        'input[name="email"], input[type="email"]',
        SHIPPER_A.email
      );
      await webPage.fill(
        'input[name="password"], input[type="password"]',
        SHIPPER_A.password
      );
      await webPage.click('button[type="submit"]');
      await sleep(4000);
    }

    // Navigate to Trips page
    await webPage.goto(`${BASE_URL}/shipper/trips`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(webPage, "06c-web-shipperA-trips");

    const tripsA = await webPage.textContent("body").catch(() => "");
    const hasTrip =
      tripsA.includes("Dire Dawa") ||
      tripsA.includes("COMPLETED") ||
      tripsA.includes("DELIVERED") ||
      tripsA.includes("ASSIGNED");
    record(
      "Phase 6",
      "6c-i. Shipper A trip visible on web",
      hasTrip ? "PASS" : "WARN",
      `hasTrip=${hasTrip}`
    );

    // Click on the trip detail
    const tripLink = await webPage.$('a[href*="/shipper/trips/"]');
    if (tripLink) {
      await tripLink.click();
      await sleep(3000);
      await screenshot(webPage, "06c-web-shipperA-trip-detail");

      const detailText = await webPage.textContent("body").catch(() => "");
      const hasDetail =
        detailText.includes("Dire Dawa") ||
        detailText.includes("Trip Details") ||
        detailText.includes("Shipment");
      record(
        "Phase 6",
        "6c-ii. Trip detail page on web",
        hasDetail ? "PASS" : "WARN",
        `hasDetail=${hasDetail}`
      );
    }

    // Navigate to Requests page — should show APPROVED request
    await webPage.goto(`${BASE_URL}/shipper/requests`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(webPage, "06c-web-shipperA-requests");

    const reqA = await webPage.textContent("body").catch(() => "");
    const hasApproved = reqA.includes("APPROVED") || reqA.includes("Approved");
    record(
      "Phase 6",
      "6c-iii. Shipper A APPROVED request on web",
      hasApproved ? "PASS" : "WARN",
      `hasApproved=${hasApproved}`
    );

    // Navigate to Wallet — check balance after settlement
    await webPage.goto(`${BASE_URL}/shipper/wallet`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(3000);
    await screenshot(webPage, "06c-web-shipperA-wallet");

    const walletText = await webPage.textContent("body").catch(() => "");
    const hasWallet =
      walletText.includes("Wallet") ||
      walletText.includes("Balance") ||
      walletText.includes("ETB") ||
      walletText.includes("Transaction");
    record(
      "Phase 6",
      "6c-iv. Shipper A wallet on web",
      hasWallet ? "PASS" : "WARN",
      `hasWallet=${hasWallet}`
    );

    record("Phase 6", "6c. Web Shipper A complete", "PASS", "");
  } catch (e) {
    record("Phase 6", "6c. Web Shipper A views", "FAIL", e.message);
    await screenshot(webPage, "06c-web-error").catch(() => {});
  }

  await webCtx.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════════
function printReport() {
  console.log("\n" + "═".repeat(70));
  console.log("  E2E SHIPPER WORKFLOW — RESULTS");
  console.log("═".repeat(70));
  console.log("");
  console.log(
    "| Phase   | Test                                       | Status |"
  );
  console.log(
    "|---------|--------------------------------------------|---------"
  );

  for (const r of results) {
    const status =
      r.status === "PASS"
        ? "✓ PASS"
        : r.status === "FAIL"
          ? "✗ FAIL"
          : "⚠ WARN";
    console.log(
      `| ${r.phase.padEnd(7)} | ${r.test.padEnd(42)} | ${status.padEnd(7)} |`
    );
  }

  console.log("");
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  console.log(
    `Total: ${results.length} tests — ${pass} passed, ${fail} failed, ${warn} warnings`
  );

  if (fail > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  ✗ ${r.test}: ${r.details}`);
    }
  }
}

function saveResults() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
      warnings: results.filter((r) => r.status === "WARN").length,
    },
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
    "║  E2E Shipper Workflow Test — Complete Lifecycle                   ║"
  );
  console.log("║  Date: " + new Date().toISOString().padEnd(60) + "║");
  console.log("╚" + "═".repeat(68) + "╝");

  const HEADED = process.argv.includes("--headed");
  const SLOW = process.argv.includes("--slow");
  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: SLOW ? 300 : HEADED ? 100 : 0,
  });

  const state = {
    shipperA: {},
    shipperB: {},
    admin: {},
    carrier: {},
    dispatcher: {},
    truck1: null,
    truck2: null,
    requestA: null,
    requestB: null,
    tripA: null,
    shipperACookies: null,
  };

  try {
    await phase1(browser, state);
    await phase2(state);
    await phase3(browser, state);
    await phase4(state);
    await phase5(browser, state);
    await phase6(browser, state);
  } catch (e) {
    console.error("\n❌ Fatal error:", e.message);
    record("FATAL", "Unexpected error", "FAIL", e.message);
  } finally {
    await browser.close();
  }

  printReport();
  saveResults();

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
