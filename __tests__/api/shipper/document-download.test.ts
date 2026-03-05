// @jest-environment node
/**
 * Load Document Download Tests (BUG-E2E-3)
 *
 * Route tested:
 * - GET /api/loads/[id]/documents/[documentId]/download
 *
 * Business rules verified:
 * - DD-1: Shipper downloads own load document → 200
 * - DD-2: Carrier downloads document for assigned load → 200
 * - DD-3: DISPATCHER with shipper-org → 403 (BUG-E2E-3 fix)
 * - DD-4: DISPATCHER with carrier-org → 403 (BUG-E2E-3 fix)
 * - DD-5: Unrelated shipper (diff org) → 403
 * - DD-6: documentId from different load → 400
 * - DD-7: Admin downloads any document → 200
 * - DD-8: Unauthenticated → 401
 *
 * Note: fs mocking doesn't work with Next.js/SWC Jest setup.
 * Auth-failure paths (401/403/400) return before reaching fs operations.
 * For 200 success tests, real files are created in beforeAll.
 */

import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
} from "../../utils/routeTestUtils";

// All mocks BEFORE require()
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// Route handler AFTER mocks
const {
  GET: downloadDocument,
} = require("@/app/api/loads/[id]/documents/[documentId]/download/route");

// ─── Real file setup ──────────────────────────────────────────────────────────
// fs mocking doesn't work with Next.js/SWC Jest transform.
// For 200 tests, create real files in public/uploads; 401/403/400 paths
// return before reaching the filesystem, so they don't need real files.

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");
const TEST_FILE_NAME = "dd-test-document.pdf";
const TEST_FILE_URL = `uploads/${TEST_FILE_NAME}`;
const TEST_FILE_PATH = join(UPLOADS_DIR, TEST_FILE_NAME);

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "carrier-user-1",
  role: "CARRIER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

// DISPATCHER with shipper-org (BUG-E2E-3 attack vector)
const dispatcherShipperOrgSession = createMockSession({
  userId: "dldl-disp-shpr-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// DISPATCHER with carrier-org (BUG-E2E-3 attack vector)
const dispatcherCarrierOrgSession = createMockSession({
  userId: "dldl-disp-carr-1",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Document Download — GET /api/loads/[id]/documents/[documentId]/download", () => {
  const loadId = "test-load-001";
  const documentId = "doc-dl-001";

  beforeAll(async () => {
    await seedTestData();

    // Create the actual upload directory and test file (fs mocking doesn't work with SWC)
    mkdirSync(UPLOADS_DIR, { recursive: true });
    writeFileSync(TEST_FILE_PATH, "PDF mock content for download tests");

    // Assign truck to load so carrier access check works (DD-2)
    await db.load.update({
      where: { id: loadId },
      data: {
        status: "IN_TRANSIT",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
      },
    });

    // Seed the primary document (points to real upload file)
    await db.document.create({
      data: {
        id: documentId,
        loadId: loadId,
        fileName: TEST_FILE_NAME,
        fileUrl: TEST_FILE_URL,
        mimeType: "application/pdf",
        fileSize: 36,
        uploadedById: "shipper-user-1",
      },
    });

    // Seed a second document on a different load (for DD-6 mismatch test)
    await db.load.create({
      data: {
        id: "dl-other-load-001",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Other load for DD-6 test",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    await db.document.create({
      data: {
        id: "doc-dl-other-001",
        loadId: "dl-other-load-001",
        fileName: "other-document.pdf",
        fileUrl: TEST_FILE_URL, // same file URL, different loadId
        mimeType: "application/pdf",
        fileSize: 36,
        uploadedById: "shipper-user-1",
      },
    });

    // Admin org + user for DD-7
    await db.organization.create({
      data: {
        id: "dldl-admin-org-1",
        name: "DL Admin Org",
        type: "PLATFORM",
        contactEmail: "dldl-admin@test.com",
        contactPhone: "+251911000095",
      },
    });
    await db.user.create({
      data: {
        id: "dldl-admin-user-1",
        email: "dldl-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "DL",
        lastName: "Admin",
        phone: "+251911000095",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "dldl-admin-org-1",
      },
    });

    // Other shipper for DD-5
    await db.organization.create({
      data: {
        id: "dldl-other-shpr-org-1",
        name: "DL Other Shipper",
        type: "SHIPPER",
        contactEmail: "dldl-other-shpr@test.com",
        contactPhone: "+251911000096",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "dldl-other-shpr-1",
        email: "dldl-other-shpr@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "DL",
        lastName: "OtherShipper",
        phone: "+251911000096",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "dldl-other-shpr-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
    // Clean up real test file
    try {
      rmSync(TEST_FILE_PATH);
    } catch {
      // ignore if already removed
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // DD-1: Shipper downloads own load document → 200
  it("DD-1: shipper downloads own load document → 200", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(TEST_FILE_NAME);
  });

  // DD-2: Carrier downloads document for assigned load → 200
  it("DD-2: carrier downloads document for assigned load → 200", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  // DD-3: DISPATCHER with shipper-org → 403 (BUG-E2E-3 fix)
  it("DD-3: DISPATCHER with shipper-org → 403 (BUG-E2E-3 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });
    const body = await parseResponse(res);

    // BUG-E2E-3 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // DD-4: DISPATCHER with carrier-org → 403 (BUG-E2E-3 fix)
  it("DD-4: DISPATCHER with carrier-org → 403 (BUG-E2E-3 fix)", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });
    const body = await parseResponse(res);

    // BUG-E2E-3 fix: DISPATCHER org matches carrierId but role is not CARRIER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // DD-5: Unrelated shipper (diff org) → 403
  it("DD-5: unrelated shipper (different org) → 403", async () => {
    const otherShipperSession = createMockSession({
      userId: "dldl-other-shpr-1",
      role: "SHIPPER",
      organizationId: "dldl-other-shpr-org-1",
      status: "ACTIVE",
    });
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // DD-6: documentId from different load → 400
  it("DD-6: documentId from different load → 400 (load mismatch)", async () => {
    setAuthSession(shipperSession);

    // doc-dl-other-001 belongs to dl-other-load-001, NOT test-load-001
    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/doc-dl-other-001/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId: "doc-dl-other-001",
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/does not belong/i);
  });

  // DD-7: Admin downloads any document → 200
  it("DD-7: admin downloads any document → 200", async () => {
    const adminSession = createMockSession({
      userId: "dldl-admin-user-1",
      role: "ADMIN",
      organizationId: "dldl-admin-org-1",
      status: "ACTIVE",
    });
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  // DD-8: Unauthenticated → 401
  it("DD-8: unauthenticated GET download → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: loadId,
      documentId,
    });

    expect(res.status).toBe(401);
  });
});
