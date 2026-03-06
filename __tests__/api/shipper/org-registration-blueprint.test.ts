// @jest-environment node
/**
 * Org Registration Blueprint Tests — Round S2
 *
 * Full lifecycle: Register → Approve → Unverify
 * Validates that isVerified and verificationStatus stay in sync at every write site,
 * and that the admin org list exposes the new S2 fields.
 *
 * Routes under test:
 *   POST   /api/auth/register
 *   POST   /api/admin/organizations/[id]/verify
 *   DELETE /api/admin/organizations/[id]/verify
 *   GET    /api/admin/organizations
 *   GET    /api/user/verification-status
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

// Provide writeAuditLog, AuditEventType, AuditSeverity for the verify route
jest.mock("@/lib/auditLog", () => ({
  writeAuditLog: jest.fn(async () => {}),
  AuditEventType: { ORG_VERIFIED: "ORG_VERIFIED" },
  AuditSeverity: { INFO: "INFO" },
}));

// ─── Route handlers (imported AFTER mocks) ────────────────────────────────────
const { POST: register } = require("@/app/api/auth/register/route");
const {
  POST: verifyOrg,
  DELETE: unverifyOrg,
} = require("@/app/api/admin/organizations/[id]/verify/route");
const { GET: listOrgs } = require("@/app/api/admin/organizations/route");
const {
  GET: verificationStatus,
} = require("@/app/api/user/verification-status/route");

// ─── Session helpers ──────────────────────────────────────────────────────────
function useAdminSession() {
  setAuthSession(
    createMockSession({
      userId: "blueprint-admin-1",
      email: "bpadmin@test.com",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: "blueprint-admin-org-1",
    })
  );
}

function useShipperSessionForOrg(userId: string, orgId: string) {
  setAuthSession(
    createMockSession({
      userId,
      email: "blueprint-shipper@example.com",
      role: "SHIPPER",
      status: "REGISTERED",
      organizationId: orgId,
    })
  );
}

// ─── Base register payload ────────────────────────────────────────────────────
const blueprintPayload = {
  email: "blueprint-shipper@example.com",
  password: "SecurePass1!",
  firstName: "Blueprint",
  lastName: "Tester",
  phone: "+251911888001",
  role: "SHIPPER",
  companyName: "Blueprint Corp",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Org Registration Blueprint — full lifecycle (Round S2)", () => {
  // Ensure admin org exists for admin-session calls
  beforeAll(async () => {
    await db.organization.create({
      data: {
        id: "blueprint-admin-org-1",
        name: "Blueprint Admin Org",
        type: "SHIPPER",
        contactEmail: "bpadmin@test.com",
        contactPhone: "+251911000099",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "blueprint-admin-1",
        email: "bpadmin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Blueprint",
        lastName: "Admin",
        phone: "+251911000099",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "blueprint-admin-org-1",
      },
    });
  });

  beforeEach(() => {
    clearAllStores();
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // ── T1: Register creates org with PENDING verificationStatus ────────────────
  it("T1: register creates org with verificationStatus=PENDING, isVerified=false, documentsLockedAt=null", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...blueprintPayload,
        email: "t1@example.com",
        phone: "+251911888101",
      },
    });
    const res = await callHandler(register, req);
    expect(res.status).toBe(201);

    const org = await db.organization.findFirst({
      where: { name: "Blueprint Corp" },
    });
    expect(org).toBeTruthy();
    expect(org.isVerified).toBe(false);
    expect(org.verificationStatus).toBe("PENDING");
    expect(org.documentsLockedAt ?? null).toBeNull();
    expect(org.rejectionReason ?? null).toBeNull();
  });

  // ── T2: verification-status returns PENDING after registration ──────────────
  it("T2: verification-status returns verificationStatus=PENDING and rejectionReason=null after register", async () => {
    const req = createRequest("POST", "http://localhost/api/auth/register", {
      body: {
        ...blueprintPayload,
        email: "t2@example.com",
        phone: "+251911888102",
      },
    });
    const regRes = await callHandler(register, req);
    expect(regRes.status).toBe(201);
    const regBody = await parseResponse(regRes);

    const org = await db.organization.findFirst({
      where: { name: "Blueprint Corp" },
    });
    expect(org).toBeTruthy();

    useShipperSessionForOrg(regBody.user.id, org.id);
    const statusReq = createRequest(
      "GET",
      "http://localhost/api/user/verification-status"
    );
    const statusRes = await verificationStatus(statusReq);
    const statusBody = await parseResponse(statusRes);

    expect(statusRes.status).toBe(200);
    expect(statusBody.organization.verificationStatus).toBe("PENDING");
    expect(statusBody.organization.rejectionReason).toBeNull();
  });

  // ── T3: Approve — response has BOTH isVerified=true AND verificationStatus=APPROVED ─
  it("T3: admin approve returns isVerified=true AND verificationStatus=APPROVED in response", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t3",
        name: "Blueprint Corp T3",
        type: "SHIPPER",
        contactEmail: "t3@example.com",
        contactPhone: "+251911888103",
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

  // ── T4: Approve — documentsLockedAt set, rejectionReason/rejectedAt cleared ──
  it("T4: admin approve sets documentsLockedAt non-null and clears rejectionReason/rejectedAt", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t4",
        name: "Blueprint Corp T4",
        type: "SHIPPER",
        contactEmail: "t4@example.com",
        contactPhone: "+251911888104",
        isVerified: false,
        verificationStatus: "PENDING",
        rejectionReason: "Old rejection reason",
        rejectedAt: new Date(Date.now() - 86400000),
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
    expect(body.organization.documentsLockedAt).toBeTruthy();
  });

  // ── T5: After approve — DB state fully in sync ──────────────────────────────
  it("T5: after approve, DB has isVerified=true, verificationStatus=APPROVED, documentsLockedAt non-null, verifiedAt set", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t5",
        name: "Blueprint Corp T5",
        type: "SHIPPER",
        contactEmail: "t5@example.com",
        contactPhone: "+251911888105",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    useAdminSession();
    const req = createRequest(
      "POST",
      `http://localhost/api/admin/organizations/${org.id}/verify`
    );
    await callHandler(verifyOrg, req, { id: org.id });

    const updated = await db.organization.findUnique({ where: { id: org.id } });
    expect(updated.isVerified).toBe(true);
    expect(updated.verificationStatus).toBe("APPROVED");
    expect(updated.documentsLockedAt).toBeTruthy();
    expect(updated.verifiedAt).toBeTruthy();
    expect(updated.rejectionReason).toBeNull();
    expect(updated.rejectedAt).toBeNull();
  });

  // ── T6: After approve — verification-status shows APPROVED ──────────────────
  it("T6: after approve, verification-status endpoint returns verificationStatus=APPROVED", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t6",
        name: "Blueprint Corp T6",
        type: "SHIPPER",
        contactEmail: "t6@example.com",
        contactPhone: "+251911888106",
        isVerified: true,
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        documentsLockedAt: new Date(),
      },
    });
    const user = await db.user.create({
      data: {
        id: "bp-user-t6",
        email: "t6@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Blueprint",
        lastName: "T6",
        phone: "+251911888106",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });

    useShipperSessionForOrg(user.id, org.id);
    const req = createRequest(
      "GET",
      "http://localhost/api/user/verification-status"
    );
    const res = await verificationStatus(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.verificationStatus).toBe("APPROVED");
    expect(body.organization.rejectionReason).toBeNull();
  });

  // ── T7: Unverify — response has isVerified=false AND verificationStatus=PENDING ─
  it("T7: admin unverify returns isVerified=false AND verificationStatus=PENDING in response", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t7",
        name: "Blueprint Corp T7",
        type: "SHIPPER",
        contactEmail: "t7@example.com",
        contactPhone: "+251911888107",
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
  });

  // ── T8: Unverify — documentsLockedAt cleared in DB ──────────────────────────
  it("T8: after unverify, DB has documentsLockedAt=null and verificationStatus=PENDING", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t8",
        name: "Blueprint Corp T8",
        type: "SHIPPER",
        contactEmail: "t8@example.com",
        contactPhone: "+251911888108",
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
    await callHandler(unverifyOrg, req, { id: org.id });

    const updated = await db.organization.findUnique({ where: { id: org.id } });
    expect(updated.isVerified).toBe(false);
    expect(updated.verificationStatus).toBe("PENDING");
    expect(updated.documentsLockedAt).toBeNull();
  });

  // ── T9: verification-status with seeded REJECTED org ────────────────────────
  it("T9: verification-status returns verificationStatus=REJECTED and rejectionReason for a rejected org", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t9",
        name: "Blueprint Corp T9",
        type: "SHIPPER",
        contactEmail: "t9@example.com",
        contactPhone: "+251911888109",
        isVerified: false,
        verificationStatus: "REJECTED",
        rejectionReason: "Missing TIN certificate",
        rejectedAt: new Date(),
      },
    });
    const user = await db.user.create({
      data: {
        id: "bp-user-t9",
        email: "t9@example.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Blueprint",
        lastName: "T9",
        phone: "+251911888109",
        role: "SHIPPER",
        status: "REGISTERED",
        organizationId: org.id,
      },
    });

    useShipperSessionForOrg(user.id, org.id);
    const req = createRequest(
      "GET",
      "http://localhost/api/user/verification-status"
    );
    const res = await verificationStatus(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.verificationStatus).toBe("REJECTED");
    expect(body.organization.rejectionReason).toBe("Missing TIN certificate");
  });

  // ── T10: Admin org list includes verificationStatus field ───────────────────
  it("T10: admin org list exposes verificationStatus field for each org (G1 fix)", async () => {
    await db.organization.create({
      data: {
        id: "bp-org-t10",
        name: "Blueprint Corp T10",
        type: "SHIPPER",
        contactEmail: "t10@example.com",
        contactPhone: "+251911888110",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost/api/admin/organizations"
    );
    const res = await listOrgs(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organizations.length).toBeGreaterThan(0);
    for (const org of body.organizations) {
      expect(org).toHaveProperty("verificationStatus");
    }
  });

  // ── T11: Freshly registered org appears in admin list with PENDING ───────────
  it("T11: freshly registered org appears in admin org list with verificationStatus=PENDING", async () => {
    await db.organization.create({
      data: {
        id: "bp-org-t11",
        name: "Blueprint Corp T11",
        type: "SHIPPER",
        contactEmail: "t11@example.com",
        contactPhone: "+251911888111",
        isVerified: false,
        verificationStatus: "PENDING",
      },
    });

    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost/api/admin/organizations"
    );
    const res = await listOrgs(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    const found = body.organizations.find(
      (o: any) => o.name === "Blueprint Corp T11"
    );
    expect(found).toBeDefined();
    expect(found.verificationStatus).toBe("PENDING");
    expect(found.isVerified).toBe(false);
  });

  // ── T12: Approving an already-APPROVED org returns 400 (idempotency guard) ──
  it("T12: approving an already-APPROVED org returns 400 (no double-approve)", async () => {
    const org = await db.organization.create({
      data: {
        id: "bp-org-t12",
        name: "Blueprint Corp T12",
        type: "SHIPPER",
        contactEmail: "t12@example.com",
        contactPhone: "+251911888112",
        isVerified: true,
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
        documentsLockedAt: new Date(),
      },
    });

    useAdminSession();
    const req = createRequest(
      "POST",
      `http://localhost/api/admin/organizations/${org.id}/verify`
    );
    const res = await callHandler(verifyOrg, req, { id: org.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already verified/i);
  });
});
