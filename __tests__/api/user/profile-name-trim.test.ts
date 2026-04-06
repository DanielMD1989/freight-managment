/**
 * Profile Name Trim Test (Item 12 / G12-1)
 *
 * PATCH /api/user/profile must reject pure-whitespace firstName/lastName.
 * Previously, " " passed Zod's min(1) but was then trimmed to "" and
 * persisted as an empty name. Schema now trims-then-validates.
 */

// @jest-environment node

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
  createMockSession,
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
mockStorage();
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    if (error.name === "ZodError" || error.issues) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten?.() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message ?? "Internal" },
      { status: 500 }
    );
  }),
}));

const { PATCH: patchProfile } = require("@/app/api/user/profile/route");

function useShipperSession() {
  setAuthSession(
    createMockSession({
      userId: "trim-user-1",
      email: "trim@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "trim-org-1",
      firstName: "Original",
      lastName: "Name",
    })
  );
}

async function callPatch(body: object) {
  const req = createRequest("PATCH", "http://localhost:3000/api/user/profile", {
    body,
  });
  return callHandler(patchProfile, req);
}

describe("PATCH /api/user/profile — name whitespace guard (G12-1)", () => {
  beforeAll(async () => {
    await db.organization.create({
      data: {
        id: "trim-org-1",
        name: "Trim Org",
        type: "SHIPPER",
        contactEmail: "trim-org@test.com",
      },
    });
    await db.user.create({
      data: {
        id: "trim-user-1",
        email: "trim@test.com",
        passwordHash: "hashed",
        firstName: "Original",
        lastName: "Name",
        phone: "+251911000111",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "trim-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  it("PT-1: rejects whitespace-only firstName with 400", async () => {
    useShipperSession();
    const res = await callPatch({ firstName: "   " });
    expect(res.status).toBe(400);
  });

  it("PT-2: rejects whitespace-only lastName with 400", async () => {
    useShipperSession();
    const res = await callPatch({ lastName: "\t\n " });
    expect(res.status).toBe(400);
  });

  it("PT-3: trims surrounding whitespace and accepts valid name", async () => {
    useShipperSession();
    const res = await callPatch({ firstName: "  Daniel  " });
    expect(res.status).toBe(200);
    const updated = await db.user.findUnique({ where: { id: "trim-user-1" } });
    expect(updated?.firstName).toBe("Daniel");
  });

  it("PT-4: rejects empty-string firstName with 400 (existing behavior)", async () => {
    useShipperSession();
    const res = await callPatch({ firstName: "" });
    expect(res.status).toBe(400);
  });
});
