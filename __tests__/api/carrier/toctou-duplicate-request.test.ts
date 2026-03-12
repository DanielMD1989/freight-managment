/**
 * G-M14-3: TOCTOU Duplicate Request Tests
 *
 * Verifies that the partial unique index on (loadId, truckId) WHERE status = 'PENDING'
 * correctly prevents duplicate PENDING requests via P2002 → 409.
 *
 * T1: Concurrent duplicate load-request → second returns 409
 * T2: Request → CANCELLED → re-request → succeeds (different status tuples)
 */

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
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks
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

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Import handlers AFTER mocks
const { POST: createLoadRequest } = require("@/app/api/load-requests/route");

describe("G-M14-3: TOCTOU Duplicate Request Prevention", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  it("T1: P2002 on concurrent duplicate → 409", async () => {
    // Simulate the race condition: findFirst returns null (no existing PENDING),
    // but the DB create throws P2002 because another concurrent request won the race.
    const originalCreate = db.loadRequest.create;
    const { Prisma } = jest.requireActual("@prisma/client");

    // Override create to throw P2002 (simulating partial unique index violation)
    (db.loadRequest.create as jest.Mock).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`loadId`,`truckId`)",
        { code: "P2002", clientVersion: "5.0.0" }
      )
    );

    const req = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      }
    );

    const res = await createLoadRequest(req);
    expect(res.status).toBe(409);

    const data = await parseResponse(res);
    expect(data.error).toContain("pending request already exists");
  });

  it("T2: request → CANCELLED → re-request → 201 (allowed)", async () => {
    // First request — succeeds
    const req1 = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
          notes: "First request",
        },
      }
    );

    const res1 = await createLoadRequest(req1);
    expect(res1.status).toBe(201);

    const data1 = await parseResponse(res1);
    const requestId = data1.loadRequest.id;

    // Cancel the request
    await db.loadRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    // Second request for same load+truck — should succeed because
    // no PENDING request exists (the old one is CANCELLED)
    const req2 = createRequest(
      "POST",
      "http://localhost:3000/api/load-requests",
      {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
          notes: "Re-request after cancellation",
        },
      }
    );

    const res2 = await createLoadRequest(req2);
    expect(res2.status).toBe(201);

    const data2 = await parseResponse(res2);
    expect(data2.loadRequest.status).toBe("PENDING");
    expect(data2.loadRequest.notes).toBe("Re-request after cancellation");
  });
});
