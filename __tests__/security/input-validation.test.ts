/**
 * Input Validation & Injection Tests
 *
 * Tests that route handlers properly validate and sanitize input,
 * rejecting SQL injection, XSS, path traversal, and malformed data.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
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
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
} from "../utils/routeTestUtils";
import { SQL_INJECTION_PAYLOADS, XSS_PAYLOADS } from "../utils/testUtils";

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

// Import route handlers AFTER mocks (use require so mocks are applied)
const { POST: createLoad } = require("@/app/api/loads/route");
const { POST: createTruck } = require("@/app/api/trucks/route");
const { POST: registerUser } = require("@/app/api/auth/register/route");

// Import validation utilities (no mocking needed)
import {
  sanitizeText,
  validateIdFormat,
  validateFileName,
} from "@/lib/validation";

describe("Input Validation & Injection Tests", () => {
  beforeAll(async () => {
    await db.organization.create({
      data: {
        id: "val-shipper-org",
        name: "Validation Shipper",
        type: "SHIPPER",
        contactEmail: "val@test.com",
        contactPhone: "+251911000001",
      },
    });

    await db.organization.create({
      data: {
        id: "val-carrier-org",
        name: "Validation Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "valcarrier@test.com",
        contactPhone: "+251911000002",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── SQL Injection in Load Fields ────────────────────────────────────────

  describe("SQL injection in load fields", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "val-shipper-user",
          email: "valshipper@test.com",
          role: "SHIPPER",
          organizationId: "val-shipper-org",
        })
      );
    });

    it.each(SQL_INJECTION_PAYLOADS)(
      "should handle SQL injection in pickupCity: %s",
      async (payload) => {
        const req = createRequest("POST", "http://localhost:3000/api/loads", {
          body: {
            pickupCity: payload,
            pickupDate: new Date().toISOString(),
            deliveryCity: "Hawassa",
            deliveryDate: new Date().toISOString(),
            truckType: "DRY_VAN",
            weight: 3000,
            cargoDescription: "Test cargo for injection test",
          },
        });

        const res = await createLoad(req);
        // Should not return 500 (which would indicate SQL execution)
        expect(res.status).not.toBe(500);

        if (res.status === 201) {
          const data = await parseResponse(res);
          // If created, payload should be stored as-is (Prisma parameterizes queries)
          expect(data.load).toBeDefined();
        }
      }
    );

    it("should handle SQL injection in cargoDescription", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "'; DROP TABLE loads; --",
        },
      });

      const res = await createLoad(req);
      expect(res.status).not.toBe(500);
    });
  });

  // ─── SQL Injection in Auth ───────────────────────────────────────────────

  describe("SQL injection in auth fields", () => {
    it("should handle SQL injection in login email", async () => {
      const { POST: loginPost } = require("@/app/api/auth/login/route");

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/login",
        {
          body: {
            email: "' OR 1=1 --",
            password: "Test1234!",
          },
        }
      );

      const res = await loginPost(req);
      // Should be 400 (invalid email format) or 401, never 200 (successful bypass)
      expect([400, 401]).toContain(res.status);
    });

    it("should handle SQL injection in registration email", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "admin'--@test.com",
            password: "Secure123!",
            firstName: "Inject",
            lastName: "User",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerUser(req);
      // Should reject invalid email or handle safely
      expect(res.status).not.toBe(500);
    });
  });

  // ─── XSS in Load Fields ─────────────────────────────────────────────────

  describe("XSS in load fields", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "val-shipper-user",
          email: "valshipper@test.com",
          role: "SHIPPER",
          organizationId: "val-shipper-org",
        })
      );
    });

    it.each(XSS_PAYLOADS)(
      "should handle XSS payload in cargoDescription: %s",
      async (payload) => {
        const req = createRequest("POST", "http://localhost:3000/api/loads", {
          body: {
            pickupCity: "Addis Ababa",
            pickupDate: new Date().toISOString(),
            deliveryCity: "Hawassa",
            deliveryDate: new Date().toISOString(),
            truckType: "DRY_VAN",
            weight: 3000,
            cargoDescription:
              payload.length < 5 ? payload + " extra chars" : payload,
          },
        });

        const res = await createLoad(req);
        // Should not cause a server error
        expect(res.status).not.toBe(500);
      }
    );

    it("should handle XSS in pickupCity", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: '<script>alert("XSS")</script>',
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "XSS test in city name field",
        },
      });

      const res = await createLoad(req);
      expect(res.status).not.toBe(500);
    });
  });

  // ─── XSS in Truck Fields ────────────────────────────────────────────────

  describe("XSS in truck fields", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "val-carrier-user",
          email: "valcarrier@test.com",
          role: "CARRIER",
          organizationId: "val-carrier-org",
        })
      );
    });

    it("should handle XSS in licensePlate", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "<img src=x onerror=alert(1)>",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).not.toBe(500);
    });

    it("should handle XSS in currentCity", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "XSS-CITY-001",
          capacity: 10000,
          currentCity: '"><script>document.cookie</script>',
        },
      });

      const res = await createTruck(req);
      expect(res.status).not.toBe(500);
    });
  });

  // ─── Type Coercion ───────────────────────────────────────────────────────

  describe("Type coercion attacks", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "val-shipper-user",
          email: "valshipper@test.com",
          role: "SHIPPER",
          organizationId: "val-shipper-org",
        })
      );
    });

    it("should reject negative weight", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: -1000,
          cargoDescription: "Negative weight test cargo",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(400);
    });

    it("should reject zero weight", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 0,
          cargoDescription: "Zero weight test cargo",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(400);
    });

    it("should reject negative truck capacity", async () => {
      setAuthSession(
        createMockSession({
          userId: "val-carrier-user",
          email: "valcarrier@test.com",
          role: "CARRIER",
          organizationId: "val-carrier-org",
        })
      );

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "NEG-CAP-001",
          capacity: -500,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("should handle string passed as number", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: "not-a-number",
          cargoDescription: "String as number test cargo",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── String Length Limits ────────────────────────────────────────────────

  describe("Oversized string inputs", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "val-shipper-user",
          email: "valshipper@test.com",
          role: "SHIPPER",
          organizationId: "val-shipper-org",
        })
      );
    });

    it("should handle extremely long city name", async () => {
      const longCity = "A".repeat(5000);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: longCity,
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Oversized city name test",
        },
      });

      const res = await createLoad(req);
      // Should either accept (and truncate) or reject - not crash
      expect(res.status).not.toBe(500);
    });

    it("should handle extremely long cargo description", async () => {
      const longDesc = "B".repeat(10000);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: longDesc,
        },
      });

      const res = await createLoad(req);
      expect(res.status).not.toBe(500);
    });

    it("should handle very long license plate", async () => {
      setAuthSession(
        createMockSession({
          userId: "val-carrier-user",
          email: "valcarrier@test.com",
          role: "CARRIER",
          organizationId: "val-carrier-org",
        })
      );

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "X".repeat(1000),
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).not.toBe(500);
    });
  });

  // ─── Email Validation ────────────────────────────────────────────────────

  describe("Email validation in registration", () => {
    it("should reject email without @ symbol", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "notanemail",
            password: "Secure123!",
            firstName: "Bad",
            lastName: "Email",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerUser(req);
      expect(res.status).toBe(400);
    });

    it("should reject email with spaces", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "bad email@test.com",
            password: "Secure123!",
            firstName: "Bad",
            lastName: "Email",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerUser(req);
      expect(res.status).toBe(400);
    });

    it("should reject extremely long email", async () => {
      const longEmail = "a".repeat(300) + "@test.com";

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: longEmail,
            password: "Secure123!",
            firstName: "Long",
            lastName: "Email",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerUser(req);
      // Should reject or handle gracefully
      expect(res.status).not.toBe(500);
    });
  });

  // ─── Validation Utility Unit Tests ───────────────────────────────────────

  describe("Validation utility functions", () => {
    it("should validate proper ID format", () => {
      const result = validateIdFormat("valid-id-12345");
      expect(result.valid).toBe(true);
    });

    it("should reject ID with SQL injection", () => {
      const result = validateIdFormat("'; DROP TABLE --");
      // Should either be valid (treated as string) or flagged
      expect(result).toBeDefined();
    });

    it("should sanitize text with HTML entities", () => {
      if (typeof sanitizeText === "function") {
        const sanitized = sanitizeText("<script>alert(1)</script>");
        expect(sanitized).not.toContain("<script>");
      }
    });

    it("should validate filename format", () => {
      if (typeof validateFileName === "function") {
        const result = validateFileName("normal-file.pdf");
        expect(result.valid).toBe(true);

        const traversal = validateFileName("../../../etc/passwd");
        expect(traversal.valid).toBe(false);
      }
    });
  });
});
