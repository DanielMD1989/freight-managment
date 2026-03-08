/**
 * Document Upload Notification Tests — Round N1
 *
 * NA-1: Company doc upload → createNotificationForRole called with role=ADMIN
 * NA-2: Truck doc upload → createNotificationForRole called with role=ADMIN
 *
 * Gap: G-N1-1
 */

// @jest-environment node

import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import {
  setAuthSession,
  createMockSession,
  clearAllStores,
  callHandler,
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
  mockLogger,
} from "../../utils/routeTestUtils";

// ─── Auth mock — must include requireRegistrationAccess ───────────────────────
jest.mock("@/lib/auth", () => ({
  requireRegistrationAccess: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireActiveUser: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireAuth: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  hashPassword: jest.fn(async (pw: string) => `hashed_${pw}`),
  verifyPassword: jest.fn(
    async (pw: string, hash: string) => hash === `hashed_${pw}`
  ),
  setSession: jest.fn(async () => {}),
  createSessionRecord: jest.fn(async () => ({ sessionId: "s-mock" })),
  createSessionToken: jest.fn(async () => "mock-token"),
  clearSession: jest.fn(async () => {}),
  revokeAllSessions: jest.fn(async () => {}),
  getSession: jest.fn(async () => null),
  getSessionAny: jest.fn(async () => null),
  generateOTP: jest.fn(() => "123456"),
  validatePasswordPolicy: jest.fn(() => ({ valid: true, errors: [] })),
  isLoginAllowed: jest.fn((status: string) => ({
    allowed: status === "ACTIVE",
  })),
  createToken: jest.fn(async () => "mock-token"),
}));

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
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }),
}));

jest.mock("@/lib/fileStorage", () => ({
  saveFile: jest
    .fn()
    .mockResolvedValue({ fileUrl: "https://storage.test/file.pdf" }),
  validateUploadedFile: jest.fn().mockReturnValue({ valid: true }),
  MAX_FILE_SIZE: 10 * 1024 * 1024,
}));

jest.mock("@/lib/validation", () => ({
  validateFileName: jest.fn().mockReturnValue({ valid: true }),
  validateIdFormat: jest.fn().mockReturnValue({ valid: true }),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
  sanitizeText: jest.fn((text: string) => text),
}));

const { POST: uploadDocument } = require("@/app/api/documents/upload/route");

const mockFile = {
  name: "test.pdf",
  size: 1024,
  type: "application/pdf",
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
};

function createUploadRequest(fields: Record<string, any>): NextRequest {
  const formData = { get: (key: string) => fields[key] ?? null };
  return {
    formData: jest.fn().mockResolvedValue(formData),
    url: "http://localhost:3000/api/documents/upload",
    headers: new Headers({ Authorization: "Bearer mock-token" }),
  } as unknown as NextRequest;
}

describe("Document Upload → Admin Notification (G-N1-1)", () => {
  let createNotificationForRole: jest.Mock;

  beforeAll(() => {
    const notifications = require("@/lib/notifications");
    createNotificationForRole = notifications.createNotificationForRole;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply file validation mock after clearAllMocks
    const { validateUploadedFile } = require("@/lib/fileStorage");
    (validateUploadedFile as jest.Mock).mockReturnValue({ valid: true });
  });

  // NA-1: Company document upload notifies admins
  it("NA-1: company doc upload → createNotificationForRole called with ADMIN role and DOCUMENTS_SUBMITTED type", async () => {
    const org = await db.organization.create({
      data: {
        id: "nu-org-1",
        name: "Upload Notify Org",
        type: "CARRIER",
        contactEmail: "nu1@test.com",
        contactPhone: "+251911100001",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "nu-user-1",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      })
    );

    const req = createUploadRequest({
      file: mockFile,
      type: "COMPANY_LICENSE",
      entityType: "company",
      entityId: org.id,
    });

    const res = await callHandler(uploadDocument, req);
    expect(res.status).toBe(200);

    expect(createNotificationForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "ADMIN",
        type: "DOCUMENTS_SUBMITTED",
      })
    );
  });

  // NA-2: Truck document upload notifies admins
  it("NA-2: truck doc upload → createNotificationForRole called with ADMIN role and DOCUMENTS_SUBMITTED type", async () => {
    const org = await db.organization.create({
      data: {
        id: "nu-org-2",
        name: "Upload Notify Carrier",
        type: "CARRIER",
        contactEmail: "nu2@test.com",
        contactPhone: "+251911100002",
      },
    });

    const truck = await db.truck.create({
      data: {
        id: "nu-truck-2",
        licensePlate: "NU-2222",
        make: "Isuzu",
        model: "NPR",
        year: 2020,
        capacity: 5,
        carrierId: org.id,
        approvalStatus: "PENDING",
      },
    });

    setAuthSession(
      createMockSession({
        userId: "nu-user-2",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: org.id,
      })
    );

    const req = createUploadRequest({
      file: mockFile,
      type: "REGISTRATION",
      entityType: "truck",
      entityId: truck.id,
    });

    const res = await callHandler(uploadDocument, req);
    expect(res.status).toBe(200);

    expect(createNotificationForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "ADMIN",
        type: "DOCUMENTS_SUBMITTED",
      })
    );
  });
});
