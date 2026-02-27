/**
 * Route Handler Test Utilities
 *
 * Provides shared infrastructure for testing Next.js API route handlers
 * with mocked auth, CSRF, rate limiting, and seeded test data.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MockSession {
  userId: string;
  email: string;
  role: string;
  status?: string;
  organizationId?: string;
  firstName?: string;
  lastName?: string;
  sessionId?: string;
}

export interface SeedData {
  shipperOrg: any;
  carrierOrg: any;
  shipperUser: any;
  carrierUser: any;
  shipperWallet: any;
  carrierWallet: any;
  load: any;
  truck: any;
  truckPosting: any;
}

// ─── Mock Session Management ─────────────────────────────────────────────────

let currentSession: MockSession | null = null;

export function createMockSession(
  overrides: Partial<MockSession> = {}
): MockSession {
  return {
    userId: "test-user-1",
    email: "test@example.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "test-org-1",
    firstName: "Test",
    lastName: "User",
    sessionId: "session-1",
    ...overrides,
  };
}

export function setAuthSession(session: MockSession | null) {
  currentSession = session;
}

export function getAuthSession(): MockSession | null {
  return currentSession;
}

// ─── Centralized Mocking ─────────────────────────────────────────────────────

/**
 * Sets up all necessary jest.mock() calls for route handler tests.
 * MUST be called at the top of test files (module scope), before any imports
 * of route handlers.
 *
 * Usage in test file:
 * ```
 * import { setupAllMocks, setAuthSession, createMockSession } from '../utils/routeTestUtils';
 * setupAllMocks();
 * // Now import route handlers AFTER mocks are set up
 * ```
 *
 * NOTE: Since jest.mock is hoisted, this function call must be at the module level.
 * The actual function provides a template; individual test files should call
 * jest.mock() directly using the patterns below.
 */

// Auth mock - controlled by setAuthSession
export function mockAuth() {
  jest.mock("@/lib/auth", () => ({
    requireAuth: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      return session;
    }),
    requireActiveUser: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      if (session.status !== "ACTIVE") {
        const error = new Error("Forbidden");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return { ...session, dbStatus: session.status };
    }),
    getSessionAny: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      return getAuthSession();
    }),
    hashPassword: jest.fn(async (pw: string) => `hashed_${pw}`),
    verifyPassword: jest.fn(
      async (pw: string, hash: string) => hash === `hashed_${pw}`
    ),
    setSession: jest.fn(async () => {}),
    createSessionRecord: jest.fn(async () => ({
      sessionId: "session-mock",
      id: "session-mock",
    })),
    createSessionToken: jest.fn(async () => "mock-session-token"),
    isLoginAllowed: jest.fn((status: string) => ({
      allowed: status === "ACTIVE" || status === "PENDING_VERIFICATION",
      limited: status === "PENDING_VERIFICATION",
      error:
        status !== "ACTIVE" && status !== "PENDING_VERIFICATION"
          ? `Account status: ${status}`
          : undefined,
    })),
    generateOTP: jest.fn(() => "123456"),
    validatePasswordPolicy: jest.fn(() => ({ valid: true, errors: [] })),
    createToken: jest.fn(async () => "mock-token"),
  }));
}

export function mockCsrf() {
  jest.mock("@/lib/csrf", () => ({
    validateCSRFWithMobile: jest.fn(async () => null), // null = valid
    requireCSRF: jest.fn(async () => null),
    generateCSRFToken: jest.fn(() => "mock-csrf-token"),
  }));
}

export function mockRateLimit() {
  jest.mock("@/lib/rateLimit", () => ({
    checkRpsLimit: jest.fn(async () => ({
      allowed: true,
      limit: 100,
      remaining: 99,
    })),
    checkRateLimit: jest.fn(async () => ({
      allowed: true,
      success: true,
      limit: 100,
      remaining: 99,
      retryAfter: 0,
      resetTime: Date.now() + 3600000,
    })),
    addRateLimitHeaders: jest.fn((res: any) => res),
    RPS_CONFIGS: {
      marketplace: { endpoint: "loads", rps: 50, burst: 100 },
      fleet: { endpoint: "trucks", rps: 30, burst: 60 },
      dashboard: { endpoint: "dashboard", rps: 5, burst: 10 },
      gps: { endpoint: "gps", rps: 30, burst: 60 },
    },
    RATE_LIMIT_TRUCK_POSTING: { maxRequests: 100, windowMs: 86400000 },
  }));
}

export function mockSecurity() {
  jest.mock("@/lib/security", () => ({
    getClientIP: jest.fn(() => "127.0.0.1"),
    isIPBlocked: jest.fn(async () => false),
    isBlockedByBruteForce: jest.fn(async () => false),
    recordFailedAttempt: jest.fn(async () => false),
    resetFailedAttempts: jest.fn(async () => {}),
    getRemainingBlockTime: jest.fn(async () => 0),
    blockIP: jest.fn(async () => {}),
    logSecurityEvent: jest.fn(async () => {}),
    sanitizeInput: jest.fn((input: string) => input.replace(/[<>"']/g, "")),
    sanitizeObject: jest.fn((obj: any) => obj),
    hasSQLInjectionPattern: jest.fn(() => false),
    generateSecureToken: jest.fn(() => "secure-token-mock"),
    hashData: jest.fn(async (data: string) => `hashed_${data}`),
  }));
}

export function mockCache() {
  jest.mock("@/lib/cache", () => ({
    LoadCache: {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      getList: jest.fn(async () => null),
      setList: jest.fn(async () => {}),
    },
    TruckCache: {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      getList: jest.fn(async () => null),
      setList: jest.fn(async () => {}),
    },
    TripCache: {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      getList: jest.fn(async () => null),
      setList: jest.fn(async () => {}),
    },
    CacheInvalidation: {
      afterLoadCreated: jest.fn(async () => {}),
      afterLoadUpdated: jest.fn(async () => {}),
      afterTruckCreated: jest.fn(async () => {}),
      afterTruckUpdated: jest.fn(async () => {}),
      afterTripUpdated: jest.fn(async () => {}),
      afterLoadRequestApproved: jest.fn(async () => {}),
      afterTruckRequestApproved: jest.fn(async () => {}),
      afterPostingCreated: jest.fn(async () => {}),
      afterPostingUpdated: jest.fn(async () => {}),
      truck: jest.fn(async () => {}),
      load: jest.fn(async () => {}),
      trip: jest.fn(async () => {}),
      allListings: jest.fn(async () => {}),
    },
    CacheTTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
    cacheAside: jest.fn(async (_key: string, fn: () => any) => fn()),
    CacheKeys: { trips: jest.fn(() => "trips-key") },
    cache: {
      get: jest.fn(async () => null),
      set: jest.fn(async () => {}),
      del: jest.fn(async () => {}),
    },
  }));
}

export function mockNotifications() {
  jest.mock("@/lib/notifications", () => ({
    createNotification: jest.fn(async () => ({ id: "notif-1" })),
    notifyTruckRequest: jest.fn(async () => {}),
    getRecentNotifications: jest.fn(async () => []),
    getUnreadCount: jest.fn(async () => 0),
    markAsRead: jest.fn(async () => {}),
    NotificationType: {
      LOAD_REQUEST: "LOAD_REQUEST",
      TRUCK_REQUEST: "TRUCK_REQUEST",
      TRIP_STATUS: "TRIP_STATUS",
      TRIP_CANCELLED: "TRIP_CANCELLED",
      SYSTEM: "SYSTEM",
    },
  }));
}

export function mockCors() {
  jest.mock("@/lib/cors", () => ({
    addCorsHeaders: jest.fn((res: any) => res),
    isOriginAllowed: jest.fn(() => true),
  }));
}

export function mockAuditLog() {
  jest.mock("@/lib/auditLog", () => ({
    logAuthFailure: jest.fn(async () => {}),
    logAuthSuccess: jest.fn(async () => {}),
  }));
}

export function mockGps() {
  jest.mock("@/lib/gpsVerification", () => ({
    validateImeiFormat: jest.fn(() => ({ valid: true })),
    verifyGpsDevice: jest.fn(async () => ({
      success: true,
      verified: true,
      lastSeen: new Date(),
    })),
    detectGpsProvider: jest.fn(() => "default"),
    determineGpsStatus: jest.fn(() => "ACTIVE"),
  }));
  jest.mock("@/lib/gpsTracking", () => ({
    enableTrackingForLoad: jest.fn(async () => {}),
  }));
}

export function mockFoundationRules() {
  jest.mock("@/lib/foundation-rules", () => ({
    getVisibilityRules: jest.fn((role: string) => ({
      canViewAllTrucks: role !== "SHIPPER",
      canViewAllLoads: role !== "CARRIER",
      canViewOwnTrucksOnly: role === "CARRIER",
      canViewOwnLoadsOnly: role === "SHIPPER",
    })),
    RULE_SHIPPER_DEMAND_FOCUS: {
      id: "SHIPPER_DEMAND_FOCUS",
      description: "Shippers cannot browse truck fleet",
    },
    RULE_ONE_ACTIVE_POST_PER_TRUCK: {
      id: "ONE_ACTIVE_POST_PER_TRUCK",
      description: "One active posting per truck",
    },
    RULE_CARRIER_FINAL_AUTHORITY: {
      id: "CARRIER_FINAL_AUTHORITY",
      description: "Carrier must approve",
    },
    validateOneActivePostPerTruck: jest.fn(() => true),
    canModifyTruckOwnership: jest.fn((role: string) => role === "CARRIER"),
    canDirectlyAssignLoads: jest.fn((role: string) =>
      ["CARRIER", "ADMIN", "SUPER_ADMIN"].includes(role)
    ),
    canProposeMatches: jest.fn((role: string) =>
      ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(role)
    ),
    canStartTrips: jest.fn((role: string) => role === "CARRIER"),
    canAcceptLoadRequests: jest.fn((role: string) => role === "CARRIER"),
    assertDispatcherCannotAssign: jest.fn(),
    assertCarrierOwnership: jest.fn(),
    assertOneActivePost: jest.fn(),
    FoundationRuleViolation: class FoundationRuleViolation extends Error {
      ruleId: string;
      constructor(ruleId: string, desc: string) {
        super(desc);
        this.ruleId = ruleId;
      }
    },
  }));
}

export function mockSms() {
  jest.mock("@/lib/sms/afromessage", () => ({
    sendMFAOTP: jest.fn(async () => ({ success: true })),
    isAfroMessageConfigured: jest.fn(() => false),
  }));
}

export function mockMatchingEngine() {
  jest.mock("@/lib/matchingEngine", () => ({
    findMatchingLoads: jest.fn(async () => []),
  }));
}

export function mockRbac() {
  jest.mock("@/lib/rbac", () => ({
    requirePermission: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      return session;
    }),
    requireRole: jest.fn(async (allowedRoles: string[]) => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      if (!allowedRoles.includes(session.role)) {
        const error = new Error("Forbidden: Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    requireAnyPermission: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) throw new Error("Unauthorized");
      return session;
    }),
    Permission: {
      CREATE_LOAD: "create_load",
      POST_LOADS: "post_loads",
      VIEW_LOADS: "view_loads",
      VIEW_ALL_LOADS: "view_all_loads",
      EDIT_LOADS: "edit_loads",
      DELETE_LOADS: "delete_loads",
      MANAGE_OWN_LOADS: "manage_own_loads",
      MANAGE_ALL_LOADS: "manage_all_loads",
      CREATE_TRUCK: "create_truck",
      POST_TRUCKS: "post_trucks",
      VIEW_TRUCKS: "view_trucks",
      VIEW_ALL_TRUCKS: "view_all_trucks",
      EDIT_TRUCKS: "edit_trucks",
      DELETE_TRUCKS: "delete_trucks",
      MANAGE_OWN_TRUCKS: "manage_own_trucks",
      MANAGE_ALL_TRUCKS: "manage_all_trucks",
      UPDATE_TRIP_STATUS: "update_trip_status",
      VIEW_WALLET: "view_wallet",
      MANAGE_WALLET: "manage_wallet",
      UPLOAD_DOCUMENTS: "upload_documents",
      VIEW_DOCUMENTS: "view_documents",
      VERIFY_DOCUMENTS: "verify_documents",
      VIEW_GPS: "view_gps",
      MANAGE_GPS_DEVICES: "manage_gps_devices",
    },
    UnauthorizedError: class UnauthorizedError extends Error {
      constructor(msg = "Unauthorized") {
        super(msg);
        this.name = "UnauthorizedError";
      }
    },
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
    getCurrentUserRole: jest.fn(async () => {
      const { getAuthSession } = require("../utils/routeTestUtils");
      const session = getAuthSession();
      return session ? session.role : null;
    }),
    hasRole: jest.fn(async () => true),
    hasAnyRole: jest.fn(async () => true),
    hasPermission: jest.fn(async () => true),
    hasAnyPermission: jest.fn(async () => true),
    hasAllPermissions: jest.fn(async () => true),
    isAdmin: jest.fn(async () => false),
    isOps: jest.fn(async () => false),
    isSuperAdmin: jest.fn(async () => false),
    canManageOrganization: jest.fn(async () => true),
    getAccessRoles: jest.fn(() => ({ canView: true, canModify: true })),
    canView: jest.fn(() => true),
    canModify: jest.fn(() => true),
    isAdminRole: jest.fn(() => false),
    isSuperAdminRole: jest.fn(() => false),
  }));
}

export function mockDispatcherPermissions() {
  jest.mock("@/lib/dispatcherPermissions", () => ({
    canViewAllTrucks: jest.fn(() => true),
    hasElevatedPermissions: jest.fn(() => false),
    canRequestTruck: jest.fn(() => true),
    canApproveRequests: jest.fn(() => true),
  }));
}

export function mockStorage() {
  jest.mock("@/lib/storage", () => ({
    uploadPOD: jest.fn(async () => ({
      success: true,
      url: "https://storage.test/pod-123.jpg",
      key: "pods/pod-123.jpg",
    })),
    uploadDocument: jest.fn(async () => ({
      success: true,
      url: "https://storage.test/doc-123.pdf",
      key: "docs/doc-123.pdf",
    })),
    uploadFile: jest.fn(async () => ({
      success: true,
      url: "https://storage.test/file-123.bin",
      key: "files/file-123.bin",
    })),
    deleteFile: jest.fn(async () => true),
    getSignedUrl: jest.fn(async () => "https://storage.test/signed-url"),
    generateFileKey: jest.fn(
      (prefix: string, name: string) => `${prefix}/${name}`
    ),
    getPublicUrl: jest.fn((key: string) => `https://storage.test/${key}`),
    fileExists: jest.fn(async () => true),
    getStorageProvider: jest.fn(() => "local"),
    isCDNEnabled: jest.fn(() => false),
  }));
}

export function mockValidation() {
  jest.mock("@/lib/validation", () => ({
    ...jest.requireActual("@/lib/validation"),
    sanitizeText: jest.fn((text: string) => text),
  }));
}

export function mockServiceFee() {
  jest.mock("@/lib/serviceFeeManagement", () => ({
    validateWalletBalancesForTrip: jest.fn(async () => ({
      valid: true,
      shipperFee: "100.00",
      carrierFee: "50.00",
    })),
    deductServiceFees: jest.fn(async () => ({ success: true })),
  }));
}

export function mockGeo() {
  jest.mock("@/lib/geo", () => ({
    calculateDistanceKm: jest.fn(() => 250),
    isValidCoordinate: jest.fn(() => true),
  }));
}

export function mockLoadUtils() {
  jest.mock("@/lib/loadUtils", () => ({
    calculateAge: jest.fn(() => 30),
    canSeeContact: jest.fn(() => true),
    maskCompany: jest.fn((name: string) => name),
  }));
}

export function mockLoadStateMachine() {
  jest.mock("@/lib/loadStateMachine", () => ({
    validateStateTransition: jest.fn(() => true),
    LoadStatus: {
      DRAFT: "DRAFT",
      POSTED: "POSTED",
      ASSIGNED: "ASSIGNED",
      PICKUP_PENDING: "PICKUP_PENDING",
      IN_TRANSIT: "IN_TRANSIT",
      DELIVERED: "DELIVERED",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
    },
  }));
}

export function mockTrustMetrics() {
  jest.mock("@/lib/trustMetrics", () => ({
    incrementCompletedLoads: jest.fn(async () => {}),
    incrementCancelledLoads: jest.fn(async () => {}),
  }));
}

export function mockBypassDetection() {
  jest.mock("@/lib/bypassDetection", () => ({
    checkSuspiciousCancellation: jest.fn(async () => ({
      suspicious: false,
    })),
  }));
}

export function mockLogger() {
  jest.mock("@/lib/logger", () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }));
}

export function mockApiErrors() {
  jest.mock("@/lib/apiErrors", () => ({
    handleApiError: jest.fn((error: any) => {
      const status =
        error.name === "ForbiddenError"
          ? 403
          : error.name === "UnauthorizedError"
            ? 401
            : 500;
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status }
      );
    }),
  }));
}

/**
 * Call ALL mock helpers. Must be called at module level (top of test file).
 */
export function setupAllMocks() {
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
}

// ─── Request Helpers ─────────────────────────────────────────────────────────

export function createRequest(
  method: string,
  url: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { body, headers = {}, cookies = {} } = options;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: "Bearer mock-token",
    ...headers,
  };

  const req = new NextRequest(url, {
    method,
    headers: new Headers(defaultHeaders),
    body: body ? JSON.stringify(body) : undefined,
  });

  Object.entries(cookies).forEach(([name, value]) => {
    req.cookies.set(name, value);
  });

  return req;
}

/**
 * Call a Next.js route handler with proper `{ params: Promise<{...}> }` shape.
 */
export async function callHandler(
  handler: (req: NextRequest, ctx?: any) => Promise<Response>,
  request: NextRequest,
  params?: Record<string, string>
): Promise<Response> {
  if (params) {
    return handler(request, { params: Promise.resolve(params) });
  }
  return handler(request);
}

/**
 * Parse JSON response body.
 */
export async function parseResponse<T = any>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

// ─── Test Data Seeding ───────────────────────────────────────────────────────

export async function seedTestData(): Promise<SeedData> {
  // Create organizations
  const shipperOrg = await db.organization.create({
    data: {
      id: "shipper-org-1",
      name: "Test Shipper Corp",
      type: "SHIPPER",
      contactEmail: "shipper@test.com",
      contactPhone: "+251911000001",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const carrierOrg = await db.organization.create({
    data: {
      id: "carrier-org-1",
      name: "Test Carrier LLC",
      type: "CARRIER_COMPANY",
      contactEmail: "carrier@test.com",
      contactPhone: "+251911000002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  // Create users
  const shipperUser = await db.user.create({
    data: {
      id: "shipper-user-1",
      email: "shipper@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Test",
      lastName: "Shipper",
      phone: "+251911000001",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: shipperOrg.id,
    },
  });

  const carrierUser = await db.user.create({
    data: {
      id: "carrier-user-1",
      email: "carrier@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Test",
      lastName: "Carrier",
      phone: "+251911000002",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: carrierOrg.id,
    },
  });

  // Create wallets
  const shipperWallet = await db.financialAccount.create({
    data: {
      id: "wallet-shipper-1",
      organizationId: shipperOrg.id,
      accountType: "SHIPPER_WALLET",
      balance: 10000,
      currency: "ETB",
    },
  });

  const carrierWallet = await db.financialAccount.create({
    data: {
      id: "wallet-carrier-1",
      organizationId: carrierOrg.id,
      accountType: "CARRIER_WALLET",
      balance: 5000,
      currency: "ETB",
    },
  });

  // Create a load
  const load = await db.load.create({
    data: {
      id: "test-load-001",
      status: "POSTED",
      pickupCity: "Addis Ababa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryCity: "Dire Dawa",
      deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "Test cargo for workflow tests",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
      postedAt: new Date(),
    },
  });

  // Create a truck
  const truck = await db.truck.create({
    data: {
      id: "test-truck-001",
      truckType: "DRY_VAN",
      licensePlate: "AA-12345",
      capacity: 10000,
      isAvailable: true,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      approvalStatus: "APPROVED",
    },
  });

  // Create a truck posting
  const truckPosting = await db.truckPosting.create({
    data: {
      id: "test-posting-001",
      truckId: truck.id,
      carrierId: carrierOrg.id,
      originCityId: "city-addis",
      originCityName: "Addis Ababa",
      availableFrom: new Date(),
      status: "ACTIVE",
      fullPartial: "FULL",
      contactName: "Test Carrier",
      contactPhone: "+251911000002",
    },
  });

  return {
    shipperOrg,
    carrierOrg,
    shipperUser,
    carrierUser,
    shipperWallet,
    carrierWallet,
    load,
    truck,
    truckPosting,
  };
}

/**
 * Clear all in-memory stores between tests.
 */
export function clearAllStores() {
  (db as any)._clearStores();
}
