/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Admin Documents API Tests
 *
 * Tests for /api/admin/documents, /api/admin/verification/queue,
 * /api/admin/verification/[id]
 */

import { db } from "@/lib/db";
import {
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
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
  mockStorage,
  mockLogger,
} from "../../utils/routeTestUtils";
import {
  useAdminSession,
  useSuperAdminSession,
  useShipperSession,
  useCarrierSession,
  useDispatcherSession,
  seedAdminTestData,
  AdminSeedData,
} from "./helpers";

// ─── Setup Mocks ──────────────────────────────────────────────────────────────
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
mockStorage();
mockLogger();

jest.mock("@/lib/rbac", () => {
  const actual = jest.requireActual("@/lib/rbac/permissions");
  return {
    requirePermission: jest.fn(async (permission: string) => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) {
        const error = new Error("Unauthorized");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      if (!actual.hasPermission(session.role, permission)) {
        const error = new Error("Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    Permission: actual.Permission,
    hasPermission: actual.hasPermission,
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
    UnauthorizedError: class UnauthorizedError extends Error {
      constructor(msg = "Unauthorized") {
        super(msg);
        this.name = "UnauthorizedError";
      }
    },
  };
});

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const status = error.name === "ForbiddenError" ? 403 : 500;
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  sanitizeRejectionReason: jest.fn((text: string) => text),
  validateIdFormat: jest.fn(() => ({ valid: true })),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: error.flatten?.() || error },
      { status: 400 }
    );
  }),
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn(async () => {}),
  createDocumentApprovalEmail: jest.fn(() => ({
    to: "test@test.com",
    subject: "Approved",
    html: "",
    text: "",
  })),
  createDocumentRejectionEmail: jest.fn(() => ({
    to: "test@test.com",
    subject: "Rejected",
    html: "",
    text: "",
  })),
}));

jest.mock("@/lib/types/admin", () => ({
  CompanyDocumentWithOrg: {},
  TruckDocumentWithCarrier: {},
}));

// Import route handlers AFTER mocks
const { GET: listDocuments } = require("@/app/api/admin/documents/route");
const {
  GET: getVerificationQueue,
} = require("@/app/api/admin/verification/queue/route");
const {
  PATCH: verifyDocument,
} = require("@/app/api/admin/verification/[id]/route");

describe("Admin Documents API", () => {
  let seed: AdminSeedData;

  beforeAll(async () => {
    seed = await seedAdminTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // ─── Authorization ─────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("GET documents returns 403 for SHIPPER", async () => {
      useShipperSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      expect(res.status).toBe(403);
    });

    it("GET documents returns 403 for CARRIER", async () => {
      useCarrierSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      expect(res.status).toBe(403);
    });

    it("GET verification queue returns 403 for DISPATCHER", async () => {
      useDispatcherSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue"
      );
      const res = await getVerificationQueue(req);
      expect(res.status).toBe(403);
    });

    it("PATCH verification returns 403 for non-admin", async () => {
      useShipperSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/verification/test-id",
        {
          body: { entityType: "company", verificationStatus: "APPROVED" },
        }
      );
      const res = await callHandler(verifyDocument, req, { id: "test-id" });
      expect(res.status).toBe(403);
    });

    it("GET documents returns 200 for ADMIN", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      expect(res.status).toBe(200);
    });

    it("GET documents returns 200 for SUPER_ADMIN", async () => {
      useSuperAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/admin/documents ───────────────────────────────────────────────

  describe("GET /api/admin/documents", () => {
    it("returns documents with default status=PENDING", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.documents).toBeDefined();
      expect(Array.isArray(body.documents)).toBe(true);
    });

    it("filter by entityType=company", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents?entityType=company"
      );
      const res = await listDocuments(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const doc of body.documents) {
        expect(doc.entityType).toBe("company");
      }
    });

    it("filter by entityType=truck", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents?entityType=truck"
      );
      const res = await listDocuments(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const doc of body.documents) {
        expect(doc.entityType).toBe("truck");
      }
    });

    it("pagination (page, limit, total, pages)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents?page=1&limit=10"
      );
      const res = await listDocuments(req);
      const body = await parseResponse(res);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBeDefined();
      expect(body.pagination.pages).toBeDefined();
    });

    it("includes statistics", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      const body = await parseResponse(res);
      expect(body.statistics).toBeDefined();
      expect(body.statistics.companyDocuments).toBeDefined();
      expect(body.statistics.truckDocuments).toBeDefined();
      expect(body.statistics.total).toBeDefined();
    });

    it("sorted by uploadedAt desc", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/documents"
      );
      const res = await listDocuments(req);
      const body = await parseResponse(res);
      if (body.documents.length > 1) {
        const dates = body.documents.map((d: any) =>
          new Date(d.uploadedAt).getTime()
        );
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
        }
      }
    });
  });

  // ─── GET /api/admin/verification/queue ──────────────────────────────────────

  describe("GET /api/admin/verification/queue", () => {
    it("returns verification queue", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue"
      );
      const res = await getVerificationQueue(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.documents).toBeDefined();
      expect(Array.isArray(body.documents)).toBe(true);
    });

    it("pagination (limit, offset, hasMore)", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue?limit=10&offset=0"
      );
      const res = await getVerificationQueue(req);
      const body = await parseResponse(res);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.offset).toBe(0);
      expect(typeof body.pagination.hasMore).toBe("boolean");
    });

    it("total count includes both entity types", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue"
      );
      const res = await getVerificationQueue(req);
      const body = await parseResponse(res);
      expect(body.pagination.total).toBeDefined();
    });

    it("filter by entityType=company", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue?entityType=company"
      );
      const res = await getVerificationQueue(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const doc of body.documents) {
        expect(doc.entityType).toBe("company");
      }
    });

    it("filter by entityType=truck", async () => {
      useAdminSession();
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue?entityType=truck"
      );
      const res = await getVerificationQueue(req);
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      for (const doc of body.documents) {
        expect(doc.entityType).toBe("truck");
      }
    });
  });

  // ─── PATCH /api/admin/verification/[id] ─────────────────────────────────────

  describe("PATCH /api/admin/verification/[id]", () => {
    it("approve company document", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.companyDoc.id}`,
        {
          body: { entityType: "company", verificationStatus: "APPROVED" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.companyDoc.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.document.verificationStatus).toBe("APPROVED");
      expect(body.document.verifiedAt).toBeDefined();
    });

    it("reject document with reason", async () => {
      useAdminSession();
      // Reset company doc
      await db.companyDocument.update({
        where: { id: seed.companyDoc.id },
        data: {
          verificationStatus: "PENDING",
          verifiedAt: null,
          verifiedById: null,
          rejectionReason: null,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.companyDoc.id}`,
        {
          body: {
            entityType: "company",
            verificationStatus: "REJECTED",
            rejectionReason: "Document is expired",
          },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.companyDoc.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.document.verificationStatus).toBe("REJECTED");
      expect(body.document.rejectionReason).toBe("Document is expired");
    });

    it("approve truck document", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.truckDoc.id}`,
        {
          body: { entityType: "truck", verificationStatus: "APPROVED" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.truckDoc.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.document.verificationStatus).toBe("APPROVED");
    });

    it("missing entityType returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.companyDoc.id}`,
        {
          body: { verificationStatus: "APPROVED" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.companyDoc.id,
      });
      expect(res.status).toBe(400);
    });

    it("missing verificationStatus returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.companyDoc.id}`,
        {
          body: { entityType: "company" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.companyDoc.id,
      });
      expect(res.status).toBe(400);
    });

    it("rejection without rejectionReason returns 400", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.companyDoc.id}`,
        {
          body: { entityType: "company", verificationStatus: "REJECTED" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.companyDoc.id,
      });
      expect(res.status).toBe(400);
    });

    it("404 for non-existent company document", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/verification/non-existent",
        {
          body: { entityType: "company", verificationStatus: "APPROVED" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });

    it("404 for non-existent truck document", async () => {
      useAdminSession();
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/admin/verification/non-existent",
        {
          body: { entityType: "truck", verificationStatus: "APPROVED" },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });

    it("sends email notification on approval", async () => {
      useAdminSession();
      await db.companyDocument.update({
        where: { id: seed.companyDoc.id },
        data: {
          verificationStatus: "PENDING",
          verifiedAt: null,
          verifiedById: null,
          organization: {
            id: seed.companyDoc.organizationId,
            name: "Test Shipper Corp",
            contactEmail: "shipper@test.com",
          },
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.companyDoc.id}`,
        {
          body: { entityType: "company", verificationStatus: "APPROVED" },
        }
      );
      await callHandler(verifyDocument, req, { id: seed.companyDoc.id });

      const { sendEmail } = require("@/lib/email");
      expect(sendEmail).toHaveBeenCalled();
    });

    it("optional expiresAt sets expiration date", async () => {
      useAdminSession();
      await db.truckDocument.update({
        where: { id: seed.truckDoc.id },
        data: {
          verificationStatus: "PENDING",
          verifiedAt: null,
          verifiedById: null,
        },
      });

      const expiresAt = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString();
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/admin/verification/${seed.truckDoc.id}`,
        {
          body: {
            entityType: "truck",
            verificationStatus: "APPROVED",
            expiresAt,
          },
        }
      );
      const res = await callHandler(verifyDocument, req, {
        id: seed.truckDoc.id,
      });
      const body = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(body.document.expiresAt).toBeDefined();
    });
  });
});
