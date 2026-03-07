/**
 * User Resubmit API Tests (G-A1-3)
 *
 * Tests for POST /api/user/resubmit
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createRequest,
  parseResponse,
  clearAllStores,
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
  mockStorage,
  mockLogger,
  createMockSession,
} from "../../utils/routeTestUtils";

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
mockStorage();
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    const status = error?.name === "ForbiddenError" ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

const { POST: resubmit } = require("@/app/api/user/resubmit/route");

describe("POST /api/user/resubmit", () => {
  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  async function createRejectedOrg(suffix: string) {
    return db.organization.create({
      data: {
        id: `rs-org-${suffix}`,
        name: `Resubmit Org ${suffix}`,
        type: "SHIPPER",
        contactEmail: `rs-${suffix}@test.com`,
        contactPhone: "+251911008000",
        verificationStatus: "REJECTED",
        rejectionReason: "Missing documents",
        rejectedAt: new Date(),
      },
    });
  }

  async function createUser(
    suffix: string,
    orgId: string,
    status = "PENDING_VERIFICATION"
  ) {
    return db.user.create({
      data: {
        id: `rs-user-${suffix}`,
        email: `rs-${suffix}@test.com`,
        passwordHash: "hash",
        firstName: "Resubmit",
        lastName: "User",
        phone: "+251911008001",
        role: "SHIPPER",
        status,
        organizationId: orgId,
      },
    });
  }

  // T-RS-1: User with REJECTED org → 200, org verificationStatus=PENDING
  it("T-RS-1: REJECTED org resubmitted → 200, org resets to PENDING", async () => {
    const org = await createRejectedOrg("1");
    const user = await createUser("1", org.id);

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.organization.verificationStatus).toBe("PENDING");

    const updatedOrg = await db.organization.findUnique({
      where: { id: org.id },
    });
    expect(updatedOrg.verificationStatus).toBe("PENDING");
    expect(updatedOrg.rejectionReason).toBeNull();
    expect(updatedOrg.rejectedAt).toBeNull();
  });

  // T-RS-2: User with PENDING org → 400
  it("T-RS-2: PENDING org resubmit attempt → 400", async () => {
    const org = await db.organization.create({
      data: {
        id: "rs-org-2",
        name: "Pending Org",
        type: "SHIPPER",
        contactEmail: "rspending@test.com",
        contactPhone: "+251911008002",
        verificationStatus: "PENDING",
      },
    });
    const user = await createUser("2", org.id);

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("not in a rejected state");
  });

  // T-RS-3: User with APPROVED org → 400
  it("T-RS-3: APPROVED org resubmit attempt → 400", async () => {
    const org = await db.organization.create({
      data: {
        id: "rs-org-3",
        name: "Approved Org",
        type: "SHIPPER",
        contactEmail: "rsapproved@test.com",
        contactPhone: "+251911008003",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    const user = await createUser("3", org.id, "ACTIVE");

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("not in a rejected state");
  });

  // T-RS-4: User with no org → 400
  it("T-RS-4: user with no org → 400", async () => {
    const user = await db.user.create({
      data: {
        id: "rs-user-no-org",
        email: "rsnoorg@test.com",
        passwordHash: "hash",
        firstName: "No",
        lastName: "Org",
        phone: "+251911008004",
        role: "SHIPPER",
        status: "REGISTERED",
      },
    });

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "REGISTERED",
        organizationId: undefined,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toContain("No organization");
  });

  // T-RS-5: Unauthenticated → 401
  it("T-RS-5: unauthenticated → 401", async () => {
    setAuthSession(null);
    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);
    expect(res.status).toBe(401);
  });

  // T-RS-6: REGISTERED user + REJECTED org → 200, user status becomes PENDING_VERIFICATION
  it("T-RS-6: REGISTERED user with REJECTED org resubmits → user promoted to PENDING_VERIFICATION", async () => {
    const org = await createRejectedOrg("6");
    const user = await createUser("6", org.id, "REGISTERED");

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "REGISTERED",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);

    expect(res.status).toBe(200);

    const updatedUser = await db.user.findUnique({ where: { id: user.id } });
    expect(updatedUser.status).toBe("PENDING_VERIFICATION");
  });

  // T-RS-7: SUSPENDED user → 403
  it("T-RS-7: SUSPENDED user → 403", async () => {
    const org = await createRejectedOrg("7");
    const user = await createUser("7", org.id, "SUSPENDED");

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "SUSPENDED",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/user/resubmit"
    );
    const res = await resubmit(req);

    expect(res.status).toBe(403);
  });
});
