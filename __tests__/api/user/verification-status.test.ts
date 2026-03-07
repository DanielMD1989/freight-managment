/**
 * User Verification Status API Tests (G-A1-4)
 *
 * Tests for GET /api/user/verification-status
 * Verifies correct companyDocument counting (not load documents).
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

const {
  GET: getVerificationStatus,
} = require("@/app/api/user/verification-status/route");

describe("GET /api/user/verification-status", () => {
  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // T1: REGISTERED user with no org → account_created=completed, documents=not_started
  it("T1: REGISTERED user with no org shows documents as not_started", async () => {
    await db.organization.create({
      data: {
        id: "vs-org-none",
        name: "No Org Shipper",
        type: "SHIPPER",
        contactEmail: "noorg@test.com",
        contactPhone: "+251911000101",
      },
    });

    const user = await db.user.create({
      data: {
        id: "vs-user-no-org",
        email: "noorg@test.com",
        passwordHash: "hash",
        firstName: "No",
        lastName: "Org",
        phone: "+251911000101",
        role: "SHIPPER",
        status: "REGISTERED",
        // organizationId intentionally omitted
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
      "GET",
      "http://localhost:3000/api/user/verification-status"
    );
    const res = await getVerificationStatus(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    const docStep = body.verification.steps.find(
      (s: any) => s.id === "documents_uploaded"
    );
    expect(docStep.status).toBe("not_started");
    expect(body.verification.documentsUploaded).toBe(false);
    expect(body.verification.documentCount).toBe(0);
  });

  // T2: REGISTERED user with org + companyDocument uploaded → documents=completed
  it("T2: REGISTERED user with uploaded companyDocument shows documents=completed", async () => {
    const org = await db.organization.create({
      data: {
        id: "vs-org-with-docs",
        name: "Org With Docs",
        type: "SHIPPER",
        contactEmail: "orgdocs@test.com",
        contactPhone: "+251911000102",
      },
    });

    const user = await db.user.create({
      data: {
        id: "vs-user-with-docs",
        email: "withdocs@test.com",
        passwordHash: "hash",
        firstName: "With",
        lastName: "Docs",
        phone: "+251911000102",
        role: "SHIPPER",
        status: "REGISTERED",
        organizationId: org.id,
      },
    });

    // Upload a company document
    await db.companyDocument.create({
      data: {
        id: "vs-company-doc-1",
        organizationId: org.id,
        uploadedById: user.id,
        documentType: "BUSINESS_LICENSE",
        fileUrl: "https://example.com/doc.pdf",
        fileName: "license.pdf",
        fileSize: 12345,
        mimeType: "application/pdf",
      },
    });

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "REGISTERED",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/user/verification-status"
    );
    const res = await getVerificationStatus(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    const docStep = body.verification.steps.find(
      (s: any) => s.id === "documents_uploaded"
    );
    expect(docStep.status).toBe("completed");
    expect(body.verification.documentsUploaded).toBe(true);
    expect(body.verification.documentCount).toBe(1);
  });

  // T3: PENDING_VERIFICATION user → admin_review=pending, nextAction=wait_review
  it("T3: PENDING_VERIFICATION user has admin_review=pending and nextAction=wait_review", async () => {
    const org = await db.organization.create({
      data: {
        id: "vs-org-pending",
        name: "Pending Org",
        type: "SHIPPER",
        contactEmail: "pending@test.com",
        contactPhone: "+251911000103",
        verificationStatus: "PENDING",
      },
    });

    const user = await db.user.create({
      data: {
        id: "vs-user-pending",
        email: "pending@test.com",
        passwordHash: "hash",
        firstName: "Pending",
        lastName: "User",
        phone: "+251911000103",
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      },
    });

    await db.companyDocument.create({
      data: {
        id: "vs-company-doc-2",
        organizationId: org.id,
        uploadedById: user.id,
        documentType: "BUSINESS_LICENSE",
        fileUrl: "https://example.com/doc2.pdf",
        fileName: "license2.pdf",
        fileSize: 12345,
        mimeType: "application/pdf",
      },
    });

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "PENDING_VERIFICATION",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/user/verification-status"
    );
    const res = await getVerificationStatus(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    const reviewStep = body.verification.steps.find(
      (s: any) => s.id === "admin_review"
    );
    expect(reviewStep.status).toBe("pending");
    expect(body.nextAction?.type).toBe("wait_review");
  });

  // T4: ACTIVE user → canAccessMarketplace=true, all steps completed
  it("T4: ACTIVE user has canAccessMarketplace=true and all steps completed", async () => {
    const org = await db.organization.create({
      data: {
        id: "vs-org-active",
        name: "Active Org",
        type: "SHIPPER",
        contactEmail: "active@test.com",
        contactPhone: "+251911000104",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    const user = await db.user.create({
      data: {
        id: "vs-user-active",
        email: "active@test.com",
        passwordHash: "hash",
        firstName: "Active",
        lastName: "User",
        phone: "+251911000104",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: org.id,
      },
    });

    // Active org needs at least one document so nextAction is null
    await db.companyDocument.create({
      data: {
        id: "vs-company-doc-active",
        organizationId: org.id,
        uploadedById: user.id,
        documentType: "BUSINESS_LICENSE",
        fileUrl: "https://example.com/active-doc.pdf",
        fileName: "license-active.pdf",
        fileSize: 12345,
        mimeType: "application/pdf",
      },
    });

    setAuthSession(
      createMockSession({
        userId: user.id,
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: org.id,
      })
    );

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/user/verification-status"
    );
    const res = await getVerificationStatus(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.canAccessMarketplace).toBe(true);
    const activatedStep = body.verification.steps.find(
      (s: any) => s.id === "account_activated"
    );
    expect(activatedStep.status).toBe("completed");
    expect(body.nextAction).toBeNull();
  });

  // T5: Unauthenticated → 401
  it("T5: unauthenticated request returns 401", async () => {
    setAuthSession(null);
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/user/verification-status"
    );
    const res = await getVerificationStatus(req);
    expect(res.status).toBe(401);
  });
});
