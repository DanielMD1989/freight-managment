// @jest-environment node
/**
 * Carrier Registration Blueprint Tests — Round S3
 *
 * Full lifecycle: Register → Org Approve → Unverify → Truck Approve
 * Validates:
 *  - Carrier org created with correct verificationStatus/isVerified fields
 *  - associationId stored on CARRIER_INDIVIDUAL org
 *  - Org approve/unverify keeps isVerified + verificationStatus in sync
 *  - CompanyDocument and TruckDocument uploadedBy resolves as full user object (S3-1/S3-2)
 *  - Admin documents list exposes uploadedBy as object, not raw ID (S3-1/S3-2)
 *  - Admin verification queue exposes uploadedBy as object (S3-1/S3-2)
 *  - Truck approval sets documentsLockedAt (S3-3)
 *  - Approving already-APPROVED truck returns 400 (idempotency)
 *
 * Routes under test:
 *   POST   /api/auth/register
 *   POST   /api/admin/organizations/[id]/verify
 *   DELETE /api/admin/organizations/[id]/verify
 *   GET    /api/admin/documents
 *   GET    /api/admin/verification/queue
 *   POST   /api/trucks/[id]/approve
 */

import { db } from "@/lib/db";
import {
  createRequest,
  callHandler,
  parseResponse,
  clearAllStores,
  setAuthSession,
  createMockSession,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
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
  mockAuditLog,
} from "../../utils/routeTestUtils";

// ─── All mocks BEFORE require() ───────────────────────────────────────────────
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
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
mockAuditLog();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => {}),
  createEmailHTML: jest.fn((c: string) => `<html>${c}</html>`),
}));

// Provide writeAuditLog for verify route
jest.mock("@/lib/auditLog", () => ({
  writeAuditLog: jest.fn(async () => {}),
  AuditEventType: {
    ORG_VERIFIED: "ORG_VERIFIED",
    TRUCK_APPROVED: "TRUCK_APPROVED",
  },
  AuditSeverity: { INFO: "INFO" },
}));

// hasPermission: ADMIN / SUPER_ADMIN → true for VERIFY_DOCUMENTS
jest.mock("@/lib/rbac/permissions", () => ({
  hasPermission: jest.fn((_role: string, _perm: string) => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    return session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";
  }),
  Permission: {
    VERIFY_DOCUMENTS: "verify_documents",
    MANAGE_USERS: "manage_users",
  },
}));

// ─── Route handlers (imported AFTER mocks) ────────────────────────────────────
const { POST: register } = require("@/app/api/auth/register/route");
const {
  POST: verifyOrg,
  DELETE: unverifyOrg,
} = require("@/app/api/admin/organizations/[id]/verify/route");
const { POST: approveTruck } = require("@/app/api/trucks/[id]/approve/route");
const { GET: listDocs } = require("@/app/api/admin/documents/route");
const { GET: queue } = require("@/app/api/admin/verification/queue/route");

// ─── Session helpers ──────────────────────────────────────────────────────────

function useAdminSession() {
  setAuthSession(
    createMockSession({
      userId: "cbp-admin-1",
      email: "cbpadmin@test.com",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: "cbp-admin-org-1",
    })
  );
}

// ─── Base register payload ────────────────────────────────────────────────────

const carrierPayload = {
  email: "cbpcarrier@example.com",
  password: "SecurePass1!",
  firstName: "Blueprint",
  lastName: "Carrier",
  phone: "+251922888001",
  role: "CARRIER",
  companyName: "Blueprint Carrier Corp",
  carrierType: "CARRIER_COMPANY",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Carrier Registration Blueprint — full lifecycle (Round S3)", () => {
  // Seed the admin org/user needed for admin-session calls
  beforeAll(async () => {
    await db.organization.create({
      data: {
        id: "cbp-admin-org-1",
        name: "CBP Admin Org",
        type: "SHIPPER",
        contactEmail: "cbpadmin@test.com",
        contactPhone: "+251911000199",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "cbp-admin-1",
        email: "cbpadmin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "CBP",
        lastName: "Admin",
        phone: "+251911000199",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "cbp-admin-org-1",
      },
    });
  });

  beforeEach(() => {
    clearAllStores();
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // ── C1: Register CARRIER_COMPANY → org has PENDING verificationStatus ────────
  it("C1: register CARRIER_COMPANY → org has verificationStatus=PENDING, isVerified=false, type=CARRIER_COMPANY", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...carrierPayload,
        email: "c1@example.com",
        phone: "+251922888101",
        carrierType: "CARRIER_COMPANY",
      },
    });
    const res = await callHandler(register, req);
    expect(res.status).toBe(201);

    const org = await db.organization.findFirst({
      where: { name: "Blueprint Carrier Corp" },
    });
    expect(org).toBeTruthy();
    expect(org.isVerified).toBe(false);
    expect(org.verificationStatus).toBe("PENDING");
    expect(org.type).toBe("CARRIER_COMPANY");
  });

  // ── C2: Register CARRIER_INDIVIDUAL with associationId ──────────────────────
  it("C2: register CARRIER_INDIVIDUAL with associationId → stored on org", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...carrierPayload,
        email: "c2@example.com",
        phone: "+251922888102",
        companyName: "BP Individual Carrier",
        carrierType: "CARRIER_INDIVIDUAL",
        associationId: "ASSOC-TEST-42",
      },
    });
    const res = await callHandler(register, req);
    expect(res.status).toBe(201);

    const org = await db.organization.findFirst({
      where: { name: "BP Individual Carrier" },
    });
    expect(org).toBeTruthy();
    expect(org.associationId).toBe("ASSOC-TEST-42");
  });

  // ── C3: Admin approves carrier org → isVerified + verificationStatus sync ────
  it("C3: admin approves carrier org → response has isVerified=true AND verificationStatus=APPROVED", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c3",
        name: "CBP Carrier C3",
        type: "CARRIER_COMPANY",
        contactEmail: "c3@example.com",
        contactPhone: "+251922888103",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    useAdminSession();
    const req = createRequest(
      "POST",
      `http://localhost/api/admin/organizations/${org.id}/verify`
    );
    const res = await callHandler(verifyOrg, req, { id: org.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.isVerified).toBe(true);
    expect(body.organization.verificationStatus).toBe("APPROVED");
  });

  // ── C4: Admin unverifies carrier org → resets both fields + documentsLockedAt ─
  it("C4: admin unverifies carrier org → isVerified=false, verificationStatus=PENDING, documentsLockedAt=null", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c4",
        name: "CBP Carrier C4",
        type: "CARRIER_COMPANY",
        contactEmail: "c4@example.com",
        contactPhone: "+251922888104",
        isVerified: true,
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        documentsLockedAt: new Date(),
      },
    });

    useAdminSession();
    const req = createRequest(
      "DELETE",
      `http://localhost/api/admin/organizations/${org.id}/verify`
    );
    const res = await callHandler(unverifyOrg, req, { id: org.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.isVerified).toBe(false);
    expect(body.organization.verificationStatus).toBe("PENDING");

    const updated = await db.organization.findUnique({ where: { id: org.id } });
    expect(updated.documentsLockedAt).toBeNull();
  });

  // ── C5: CompanyDocument uploadedBy resolves to full user object (S3-1) ───────
  it("C5: CompanyDocument created with uploadedById → db include resolves uploadedBy as full user object", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c5",
        name: "CBP Carrier C5",
        type: "CARRIER_COMPANY",
        contactEmail: "c5@example.com",
        contactPhone: "+251922888105",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });
    const user = await db.user.create({
      data: {
        id: "cbp-user-c5",
        email: "c5uploader@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Upload",
        lastName: "Er",
        phone: "+251922888105",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    await db.companyDocument.create({
      data: {
        id: "cbp-cdoc-c5",
        organizationId: org.id,
        type: "BUSINESS_LICENSE",
        fileName: "bl.pdf",
        fileUrl: "https://storage.test/bl.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        verificationStatus: "PENDING",
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
    });

    const doc = await db.companyDocument.findFirst({
      where: { id: "cbp-cdoc-c5" },
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    expect(doc).toBeTruthy();
    expect(doc.uploadedBy).toBeTruthy();
    expect(doc.uploadedBy.id).toBe(user.id);
    expect(doc.uploadedBy.email).toBe("c5uploader@example.com");
    expect(doc.uploadedBy.firstName).toBe("Upload");
  });

  // ── C6: TruckDocument uploadedBy resolves to full user object (S3-2) ─────────
  it("C6: TruckDocument created with uploadedById → db include resolves uploadedBy as full user object", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c6",
        name: "CBP Carrier C6",
        type: "CARRIER_COMPANY",
        contactEmail: "c6@example.com",
        contactPhone: "+251922888106",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });
    const user = await db.user.create({
      data: {
        id: "cbp-user-c6",
        email: "c6uploader@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Truck",
        lastName: "Uploader",
        phone: "+251922888106",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    const truck = await db.truck.create({
      data: {
        id: "cbp-truck-c6",
        truckType: "DRY_VAN",
        licensePlate: "CBP-C6-001",
        capacity: 10000,
        carrierId: org.id,
        createdById: user.id,
        approvalStatus: "PENDING",
      },
    });
    await db.truckDocument.create({
      data: {
        id: "cbp-tdoc-c6",
        truckId: truck.id,
        type: "INSURANCE",
        fileName: "ins.pdf",
        fileUrl: "https://storage.test/ins.pdf",
        fileSize: 512,
        mimeType: "application/pdf",
        verificationStatus: "PENDING",
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
    });

    const doc = await db.truckDocument.findFirst({
      where: { id: "cbp-tdoc-c6" },
      include: {
        uploadedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    expect(doc).toBeTruthy();
    expect(doc.uploadedBy).toBeTruthy();
    expect(doc.uploadedBy.id).toBe(user.id);
    expect(doc.uploadedBy.email).toBe("c6uploader@example.com");
    expect(doc.uploadedBy.firstName).toBe("Truck");
  });

  // ── C7: Admin documents list returns uploadedBy as object (S3-1/S3-2) ────────
  it("C7: GET /api/admin/documents returns uploadedBy as object with firstName/lastName (not raw ID)", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c7",
        name: "CBP Carrier C7",
        type: "CARRIER_COMPANY",
        contactEmail: "c7@example.com",
        contactPhone: "+251922888107",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });
    const user = await db.user.create({
      data: {
        id: "cbp-user-c7",
        email: "c7uploader@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "C7",
        lastName: "Uploader",
        phone: "+251922888107",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    await db.companyDocument.create({
      data: {
        id: "cbp-cdoc-c7",
        organizationId: org.id,
        type: "BUSINESS_LICENSE",
        fileName: "c7.pdf",
        fileUrl: "https://storage.test/c7.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        verificationStatus: "PENDING",
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
    });

    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost/api/admin/documents?entityType=company"
    );
    const res = await listDocs(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    const doc = body.documents.find((d: any) => d.id === "cbp-cdoc-c7");
    expect(doc).toBeDefined();
    expect(typeof doc.uploadedBy).toBe("object");
    expect(doc.uploadedBy).not.toBeNull();
    expect(doc.uploadedBy.firstName).toBe("C7");
    expect(doc.uploadedBy.lastName).toBe("Uploader");
  });

  // ── C8: Admin verification queue returns uploadedBy object (S3-1/S3-2) ───────
  it("C8: GET /api/admin/verification/queue returns uploadedBy as object (not uploadedById string)", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c8",
        name: "CBP Carrier C8",
        type: "CARRIER_COMPANY",
        contactEmail: "c8@example.com",
        contactPhone: "+251922888108",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });
    const user = await db.user.create({
      data: {
        id: "cbp-user-c8",
        email: "c8uploader@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "C8",
        lastName: "Uploader",
        phone: "+251922888108",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    await db.companyDocument.create({
      data: {
        id: "cbp-cdoc-c8",
        organizationId: org.id,
        type: "BUSINESS_LICENSE",
        fileName: "c8.pdf",
        fileUrl: "https://storage.test/c8.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        verificationStatus: "PENDING",
        uploadedById: user.id,
        uploadedAt: new Date(),
      },
    });

    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost/api/admin/verification/queue?entityType=company"
    );
    const res = await queue(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    const doc = body.documents.find((d: any) => d.id === "cbp-cdoc-c8");
    expect(doc).toBeDefined();
    expect(typeof doc.uploadedBy).toBe("object");
    expect(doc.uploadedBy).not.toBeNull();
    expect(doc.uploadedBy.email).toBe("c8uploader@example.com");
    // Raw ID must not be present
    expect(doc).not.toHaveProperty("uploadedById");
  });

  // ── C9: Truck approval sets documentsLockedAt (S3-3) ─────────────────────────
  it("C9: approving a PENDING truck sets documentsLockedAt to a non-null timestamp in DB", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c9",
        name: "CBP Carrier C9",
        type: "CARRIER_COMPANY",
        contactEmail: "c9@example.com",
        contactPhone: "+251922888109",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    const user = await db.user.create({
      data: {
        id: "cbp-user-c9",
        email: "c9carrier@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "C9",
        lastName: "Carrier",
        phone: "+251922888109",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    const truck = await db.truck.create({
      data: {
        id: "cbp-truck-c9",
        truckType: "DRY_VAN",
        licensePlate: "CBP-C9-001",
        capacity: 10000,
        carrierId: org.id,
        createdById: user.id,
        approvalStatus: "PENDING",
      },
    });

    useAdminSession();
    const req = createRequest(
      "POST",
      `http://localhost/api/trucks/${truck.id}/approve`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(approveTruck, req, { id: truck.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.truck.approvalStatus).toBe("APPROVED");
    expect(body.truck.documentsLockedAt).toBeTruthy();

    // Also verify DB state
    const updatedTruck = await db.truck.findUnique({ where: { id: truck.id } });
    expect(updatedTruck.documentsLockedAt).toBeTruthy();
    expect(updatedTruck.approvalStatus).toBe("APPROVED");
  });

  // ── C10: Approving already-APPROVED truck returns 400 (idempotency) ──────────
  it("C10: approving an already-APPROVED truck returns 400 (no double-approve)", async () => {
    const org = await db.organization.create({
      data: {
        id: "cbp-org-c10",
        name: "CBP Carrier C10",
        type: "CARRIER_COMPANY",
        contactEmail: "c10@example.com",
        contactPhone: "+251922888110",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    const user = await db.user.create({
      data: {
        id: "cbp-user-c10",
        email: "c10carrier@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "C10",
        lastName: "Carrier",
        phone: "+251922888110",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });
    const truck = await db.truck.create({
      data: {
        id: "cbp-truck-c10",
        truckType: "DRY_VAN",
        licensePlate: "CBP-C10-001",
        capacity: 10000,
        carrierId: org.id,
        createdById: user.id,
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        documentsLockedAt: new Date(),
      },
    });

    useAdminSession();
    const req = createRequest(
      "POST",
      `http://localhost/api/trucks/${truck.id}/approve`,
      { body: { action: "APPROVE" } }
    );
    const res = await callHandler(approveTruck, req, { id: truck.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already approved/i);
  });
});
