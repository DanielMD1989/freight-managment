// @jest-environment node
import { mkdirSync, rmSync } from "fs";
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
  SeedData,
} from "../../utils/routeTestUtils";

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

// Route handler — imported AFTER all mocks
const {
  GET: getDocuments,
  POST: uploadDocument,
} = require("@/app/api/loads/[id]/documents/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const unrelatedSession = createMockSession({
  userId: "unrelated-user-1",
  role: "SHIPPER",
  organizationId: "unrelated-org-1",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "admin-user-1",
  role: "ADMIN",
  organizationId: "admin-org-1",
  status: "ACTIVE",
});

// ─── Helper: build a FormData-style NextRequest (same pattern as pod-management) ─

function createDocFormDataRequest(
  url: string,
  file?: { name: string; type: string; size: number } | null,
  docType?: string
) {
  const req = createRequest("POST", url, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const mockFormData = {
    get: jest.fn((key: string) => {
      if (key === "file" && file) {
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: async () => new ArrayBuffer(file.size),
        };
      }
      if (key === "type") return docType ?? null;
      if (key === "description") return "Test document";
      return null;
    }),
  };

  (req as any).formData = jest.fn(async () => mockFormData);
  return req;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Load Documents — GET /api/loads/[id]/documents", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("returns 200 with empty documents array for shipper on own load", async () => {
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/documents`
    );
    const res = await callHandler(getDocuments, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("documents");
    expect(Array.isArray(body.documents)).toBe(true);
  });

  it("returns 403 for user from unrelated org", async () => {
    setAuthSession(unrelatedSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/documents`
    );
    const res = await callHandler(getDocuments, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/Forbidden/i);
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/documents`
    );
    const res = await callHandler(getDocuments, req, { id: seed.load.id });
    await parseResponse(res);

    expect(res.status).toBe(401);
  });

  it("returns 200 for admin on any load", async () => {
    const { db } = require("@/lib/db");
    await db.user.upsert({
      where: { id: "admin-user-1" },
      update: {},
      create: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/documents`
    );
    const res = await callHandler(getDocuments, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("documents");
  });
});

describe("Load Documents — POST /api/loads/[id]/documents", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
    // Create the upload directory so the real fs.writeFile can succeed
    // (jest.mock("fs/promises") doesn't intercept built-in modules with Next.js SWC)
    mkdirSync(`public/uploads/loads/${seed.load.id}`, { recursive: true });
  });

  afterAll(() => {
    clearAllStores();
    // Clean up test uploads
    try {
      rmSync(`public/uploads/loads/${seed.load.id}`, {
        recursive: true,
        force: true,
      });
    } catch {
      /* ignore cleanup errors */
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("returns 200 with document record when shipper uploads valid PDF", async () => {
    const req = createDocFormDataRequest(
      `http://localhost:3000/api/loads/${seed.load.id}/documents`,
      { name: "bill-of-lading.pdf", type: "application/pdf", size: 1024 },
      "BOL"
    );
    const res = await callHandler(uploadDocument, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect([200, 201]).toContain(res.status);
    expect(body).toHaveProperty("document");
    expect(body.document).toHaveProperty("loadId", seed.load.id);
    expect(body.document).toHaveProperty("type", "BOL");
  });

  it("returns 400 when no file is provided", async () => {
    const req = createDocFormDataRequest(
      `http://localhost:3000/api/loads/${seed.load.id}/documents`,
      null,
      "INVOICE"
    );
    const res = await callHandler(uploadDocument, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/file/i);
  });

  it("returns 400 for invalid MIME type (text/plain not allowed)", async () => {
    const req = createDocFormDataRequest(
      `http://localhost:3000/api/loads/${seed.load.id}/documents`,
      { name: "notes.txt", type: "text/plain", size: 512 },
      "OTHER"
    );
    const res = await callHandler(uploadDocument, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/file type/i);
  });

  it("returns 400 for invalid document type enum", async () => {
    const req = createDocFormDataRequest(
      `http://localhost:3000/api/loads/${seed.load.id}/documents`,
      { name: "doc.pdf", type: "application/pdf", size: 512 },
      "INVALID_TYPE"
    );
    const res = await callHandler(uploadDocument, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/document type/i);
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createDocFormDataRequest(
      `http://localhost:3000/api/loads/${seed.load.id}/documents`,
      { name: "doc.pdf", type: "application/pdf", size: 512 },
      "BOL"
    );
    const res = await callHandler(uploadDocument, req, { id: seed.load.id });
    await parseResponse(res);

    expect(res.status).toBe(401);
  });
});
