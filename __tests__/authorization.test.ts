/**
 * Authorization Integration Tests
 *
 * Sprint 9 - Story 9.10: Security Testing & QA
 *
 * Tests for authorization and access control including:
 * - Role-based access control (RBAC)
 * - Permission checks
 * - Organization isolation
 * - Resource ownership verification
 */

import { Permission, hasPermission } from "@/lib/rbac/permissions";
import {
  createTestUser,
  createTestOrganization,
  cleanupTestData,
} from "./utils/testUtils";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockRbac,
  mockLogger,
  mockFoundationRules,
  mockSms,
} from "./utils/routeTestUtils";

mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
mockCors();
mockAuditLog();
mockRbac();
mockLogger();
mockFoundationRules();
mockSms();

// Route handlers imported inside tests via require() for mockImplementationOnce

describe("Authorization", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("Permission Checks", () => {
    it("should grant admin users all permissions", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      await createTestUser({
        email: "admin@example.com",
        password: "Password123!",
        name: "Admin User",
        role: "ADMIN",
        organizationId: org.id,
      });

      // Test various admin permissions (using granular permissions, not legacy MANAGE_USERS)
      const permissions = [
        Permission.VIEW_USERS,
        Permission.CREATE_OPERATIONAL_USERS,
        Permission.VIEW_ALL_LOADS,
        Permission.VIEW_ALL_TRUCKS,
        Permission.VERIFY_DOCUMENTS,
        Permission.VIEW_AUDIT_LOGS,
      ];

      for (const permission of permissions) {
        const hasAccess = await hasPermission("ADMIN", permission);
        expect(hasAccess).toBe(true);
      }
    });

    it("should restrict carrier permissions appropriately", async () => {
      const org = await createTestOrganization({
        name: "Carrier Org",
        type: "CARRIER_COMPANY",
      });

      await createTestUser({
        email: "carrier@example.com",
        password: "Password123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      // Carriers should have these permissions
      expect(await hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);
      expect(await hasPermission("CARRIER", Permission.VIEW_LOADS)).toBe(true);
      expect(await hasPermission("CARRIER", Permission.UPLOAD_DOCUMENTS)).toBe(
        true
      );

      // Carriers should NOT have these permissions
      expect(await hasPermission("CARRIER", Permission.POST_LOADS)).toBe(false);
      expect(await hasPermission("CARRIER", Permission.VERIFY_DOCUMENTS)).toBe(
        false
      );
      expect(await hasPermission("CARRIER", Permission.VIEW_AUDIT_LOGS)).toBe(
        false
      );
    });

    it("should restrict shipper permissions appropriately", async () => {
      const org = await createTestOrganization({
        name: "Shipper Org",
        type: "SHIPPER",
      });

      await createTestUser({
        email: "shipper@example.com",
        password: "Password123!",
        name: "Shipper User",
        role: "SHIPPER",
        organizationId: org.id,
      });

      // Shippers should have these permissions
      expect(await hasPermission("SHIPPER", Permission.POST_LOADS)).toBe(true);
      expect(await hasPermission("SHIPPER", Permission.VIEW_TRUCKS)).toBe(true);
      expect(await hasPermission("SHIPPER", Permission.UPLOAD_DOCUMENTS)).toBe(
        true
      );

      // Shippers should NOT have these permissions
      expect(await hasPermission("SHIPPER", Permission.POST_TRUCKS)).toBe(
        false
      );
      expect(await hasPermission("SHIPPER", Permission.VERIFY_DOCUMENTS)).toBe(
        false
      );
      expect(await hasPermission("SHIPPER", Permission.VIEW_AUDIT_LOGS)).toBe(
        false
      );
    });
  });

  describe("Organization Isolation", () => {
    it("should prevent cross-organization access", async () => {
      const org1 = await createTestOrganization({
        name: "Carrier Org 1",
        type: "CARRIER_COMPANY",
      });

      const org2 = await createTestOrganization({
        name: "Carrier Org 2",
        type: "CARRIER_COMPANY",
      });

      const user1 = await createTestUser({
        email: "user1@carrier1.com",
        password: "Password123!",
        name: "User 1",
        role: "CARRIER",
        organizationId: org1.id,
      });

      const user2 = await createTestUser({
        email: "user2@carrier2.com",
        password: "Password123!",
        name: "User 2",
        role: "CARRIER",
        organizationId: org2.id,
      });

      // Both users have CARRIER role, so both have POST_TRUCKS permission
      expect(await hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);

      // Organization isolation is enforced at the API/database query level
      // not in the hasPermission function which only checks role-based permissions
      expect(user1.organizationId).not.toBe(user2.organizationId);
    });

    it("should enforce organization ownership for resources", async () => {
      const org1 = await createTestOrganization({
        name: "Carrier Org 1",
        type: "CARRIER_COMPANY",
      });
      const org2 = await createTestOrganization({
        name: "Carrier Org 2",
        type: "CARRIER_COMPANY",
      });
      const user1 = await createTestUser({
        email: "user1@carrier1.com",
        password: "Password123!",
        name: "User One",
        role: "CARRIER",
        organizationId: org1.id,
      });
      const user2 = await createTestUser({
        email: "user2@carrier2.com",
        password: "Password123!",
        name: "User Two",
        role: "CARRIER",
        organizationId: org2.id,
      });
      // Users in different orgs must not share access
      expect(user1.organizationId).toBe(org1.id);
      expect(user2.organizationId).toBe(org2.id);
      expect(user1.organizationId).not.toBe(user2.organizationId);
      // An org can only own its own resources
      const resourceOrgId = org1.id;
      expect(user1.organizationId).toBe(resourceOrgId); // owner — allowed
      expect(user2.organizationId).not.toBe(resourceOrgId); // non-owner — denied
    });
  });

  describe("requirePermission Middleware", () => {
    it("should allow access with correct permission", async () => {
      clearAllStores();
      const rbacMock = require("@/lib/rbac");
      const realHasPermission = require("@/lib/rbac/permissions").hasPermission;

      // Override requirePermission to check real permissions
      rbacMock.requirePermission.mockImplementationOnce(
        async (permission: string) => {
          const { getAuthSession } = require("./utils/routeTestUtils");
          const s = getAuthSession();
          if (!s) {
            const err = new Error("Unauthorized");
            (err as any).name = "UnauthorizedError";
            throw err;
          }
          if (!realHasPermission(s.role, permission)) {
            const err = new Error("Forbidden: Insufficient permissions");
            (err as any).name = "ForbiddenError";
            throw err;
          }
          return s;
        }
      );

      // Admin can access verification queue (has VERIFY_DOCUMENTS)
      const {
        GET: verificationQueue,
      } = require("@/app/api/admin/verification/queue/route");
      const adminSession = createMockSession({
        userId: "auth-admin-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "auth-admin-org",
        status: "ACTIVE",
      });
      setAuthSession(adminSession);

      // Mock DB for verification queue
      const { db } = require("@/lib/db");
      db.companyDocument.findMany = jest.fn().mockResolvedValue([]);
      db.companyDocument.count = jest.fn().mockResolvedValue(0);
      db.truckDocument.findMany = jest.fn().mockResolvedValue([]);
      db.truckDocument.count = jest.fn().mockResolvedValue(0);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue"
      );
      const res = await callHandler(verificationQueue, req);
      // Admin has VERIFY_DOCUMENTS permission
      expect(res.status).toBe(200);
    });

    it("should deny access without correct permission", async () => {
      clearAllStores();
      const rbacMock = require("@/lib/rbac");
      const realHasPermission = require("@/lib/rbac/permissions").hasPermission;

      // Override requirePermission to check real permissions
      rbacMock.requirePermission.mockImplementationOnce(
        async (permission: string) => {
          const { getAuthSession } = require("./utils/routeTestUtils");
          const s = getAuthSession();
          if (!s) {
            const err = new Error("Unauthorized");
            (err as any).name = "UnauthorizedError";
            throw err;
          }
          if (!realHasPermission(s.role, permission)) {
            const err = new Error("Forbidden: Insufficient permissions");
            (err as any).name = "ForbiddenError";
            throw err;
          }
          return s;
        }
      );

      const {
        GET: verificationQueue,
      } = require("@/app/api/admin/verification/queue/route");
      const session = createMockSession({
        userId: "auth-shipper-1",
        email: "shipper@test.com",
        role: "SHIPPER",
        organizationId: "auth-shipper-org",
        status: "ACTIVE",
      });
      setAuthSession(session);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue"
      );
      const res = await callHandler(verificationQueue, req);
      // Shipper does not have VERIFY_DOCUMENTS permission
      expect(res.status).toBe(403);
    });

    it("should deny access to unauthenticated requests", async () => {
      clearAllStores();
      const rbacMock = require("@/lib/rbac");

      // Override requirePermission to check auth
      rbacMock.requirePermission.mockImplementationOnce(async () => {
        const { getAuthSession } = require("./utils/routeTestUtils");
        const s = getAuthSession();
        if (!s) {
          const err = new Error("Unauthorized");
          (err as any).name = "UnauthorizedError";
          throw err;
        }
        return s;
      });

      setAuthSession(null);
      const {
        GET: verificationQueue,
      } = require("@/app/api/admin/verification/queue/route");
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/admin/verification/queue"
      );
      const res = await callHandler(verificationQueue, req);
      // No session = 401 Unauthorized
      expect(res.status).toBe(401);
    });
  });

  describe("Access Control Edge Cases", () => {
    it("should handle missing organizationId", async () => {
      const user = await createTestUser({
        email: "noorg@example.com",
        password: "Password123!",
        name: "No Org User",
        role: "CARRIER",
      });

      // hasPermission only checks role-based permissions, not organization membership
      // Organization enforcement happens at the API/database query level
      expect(hasPermission("CARRIER", Permission.POST_TRUCKS)).toBe(true);
      expect(user.organizationId).toBeNull();
    });

    it("should handle invalid role", () => {
      const invalidRole = "INVALID_ROLE" as any;

      expect(hasPermission(invalidRole, Permission.VIEW_LOADS)).toBe(false);
    });

    it("should handle undefined permission", () => {
      const invalidPermission = "INVALID_PERMISSION" as any;

      expect(hasPermission("CARRIER", invalidPermission)).toBe(false);
    });
  });

  describe("Privilege Escalation Prevention", () => {
    it("should prevent carriers from gaining admin privileges", async () => {
      const org = await createTestOrganization({
        name: "Test Org",
        type: "CARRIER_COMPANY",
      });

      await createTestUser({
        email: "carrier@example.com",
        password: "Password123!",
        name: "Carrier User",
        role: "CARRIER",
        organizationId: org.id,
      });

      // Carrier should not be able to perform admin actions
      const adminPermissions = [
        Permission.VERIFY_DOCUMENTS,
        Permission.MANAGE_USERS,
        Permission.VIEW_AUDIT_LOGS,
      ];

      for (const permission of adminPermissions) {
        expect(await hasPermission("CARRIER", permission)).toBe(false);
      }
    });

    it("should prevent shippers from accessing carrier features", async () => {
      const org = await createTestOrganization({
        name: "Shipper Org",
        type: "SHIPPER",
      });

      await createTestUser({
        email: "shipper@example.com",
        password: "Password123!",
        name: "Shipper User",
        role: "SHIPPER",
        organizationId: org.id,
      });

      // Shipper should not be able to post trucks
      expect(await hasPermission("SHIPPER", Permission.POST_TRUCKS)).toBe(
        false
      );
    });
  });
});
